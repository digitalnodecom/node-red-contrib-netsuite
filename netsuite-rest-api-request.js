const crypto = require('crypto');
const axios = require('axios');
const url = require('url'); // Add URL module for better URL parsing

function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

function generateBaseString(method, url, oauthParams, queryParams = {}) {
    const allParams = {
        ...oauthParams,
        ...queryParams
    };

    const sortedParams = Object.keys(allParams)
        .sort()
        .reduce((acc, key) => {
            acc[key] = allParams[key].toString();
            return acc;
        }, {});

    const paramString = Object.entries(sortedParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    // Extract base URL without query parameters
    const baseUrl = url.split('?')[0];

    return [
        method.toUpperCase(),
        encodeURIComponent(baseUrl),
        encodeURIComponent(paramString)
    ].join('&');
}

function generateAuthHeader(node, method, fullUrl, queryParams = {}) {
    const realm = node.oauth.realm;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    // Parse the URL to separate base URL and existing query parameters
    const parsedUrl = new URL(fullUrl);
    const baseUrl = parsedUrl.origin + parsedUrl.pathname;
    
    // Combine existing URL query parameters with passed queryParams
    const combinedParams = {};
    
    // First get any params already in the URL
    for (const [key, value] of parsedUrl.searchParams) {
        combinedParams[key] = value;
    }
    
    // Then add any additional query params
    if (queryParams instanceof URLSearchParams) {
        for (const [key, value] of queryParams) {
            combinedParams[key] = value;
        }
    } else {
        Object.assign(combinedParams, queryParams);
    }

    let oauthParams = {
        oauth_consumer_key: node.oauth.consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp,
        oauth_token: node.oauth.token,
        oauth_version: '1.0'
    };

    const baseString = generateBaseString(method, baseUrl, oauthParams, combinedParams);
    const signingKey = `${encodeURIComponent(node.oauth.consumerSecret)}&${encodeURIComponent(node.oauth.tokenSecret)}`;
    const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');

    // Construct OAuth Header
    let authHeader = 'OAuth ' + [
        `realm="${encodeURIComponent(realm)}"`,
        `oauth_consumer_key="${encodeURIComponent(node.oauth.consumerKey)}"`,
        `oauth_token="${encodeURIComponent(node.oauth.token)}"`,
        `oauth_signature_method="HMAC-SHA256"`,
        `oauth_timestamp="${encodeURIComponent(timestamp)}"`,
        `oauth_nonce="${encodeURIComponent(nonce)}"`,
        `oauth_version="1.0"`,
        `oauth_signature="${encodeURIComponent(signature)}"`
    ].join(', ');

    return authHeader;
}

async function executeRequest(node, config, msg) {
    try {
        // Get URL and method from config or msg
        let requestUrl = config.url || msg.url;
        const method = config.method || msg.method || 'GET';
        
        if (!requestUrl) {
            throw new Error("The URL is missing. Please provide a valid URL.");
        }
        if (!node.oauth || !node.oauth.consumerKey || !node.oauth.consumerSecret || !node.oauth.token || !node.oauth.tokenSecret) {
            throw new Error("OAuth credentials are missing or incomplete.");
        }

        // Check if this is a pagination URL from a previous response
        // If so, use it directly without modifying
        const isPaginationUrl = msg.isPaginationUrl === true;
        
        if (!isPaginationUrl) {
            // Only append these parameters if not using a pagination URL
            const netsuiteobject = config.netsuiteobject || msg.netsuiteobject;
            const objectid = config.objectid || msg.objectid;
            const objectexternalid = config.objectexternalid || msg.objectexternalid;
            
            // Build the final URL with resource path components
            if (netsuiteobject) {
                requestUrl += `/${netsuiteobject}`;
            }
            if (objectid) {
                requestUrl += `/${objectid}`;
            }
            if (objectexternalid) {
                requestUrl += `/eid:${objectexternalid}`;
            }
        }
        
        // Parse the URL to extract existing query params
        const parsedUrl = new URL(requestUrl);
        const existingParams = parsedUrl.searchParams;
        
        // Only add limit/offset if not using pagination URL
        if (!isPaginationUrl) {
            const limit = config.limit || msg.limit;
            const offset = config.offset || msg.offset;
            
            if (limit && !existingParams.has('limit')) existingParams.set('limit', limit);
            if (offset && !existingParams.has('offset')) existingParams.set('offset', offset);
        }
        
        // Generate the OAuth header with the URL's base part and all combined params
        const authHeader = generateAuthHeader(node, method, requestUrl, existingParams);
        
        // Prepare the final request options
        const bodyNetsuite = config.bodyNetsuite || msg.bodyNetsuite;
        
        const requestOptions = {
            method: method.toUpperCase(),
            url: requestUrl,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data: bodyNetsuite ? JSON.parse(bodyNetsuite) : null,
        };
        
        node.status({ fill: "blue", shape: "dot", text: "requesting..." });
        const response = await axios(requestOptions);
        
        msg.payload = {
            headers: response.headers,
            statusCode: response.status,
            data: response.data,
        };
        
        node.status({ fill: "green", shape: "dot", text: "success" });
        node.send(msg);
    } catch (error) {
        node.status({ fill: "red", shape: "ring", text: error.message });
        node.error("NetSuite Error: " + error.message, msg);

        if (error.response && error.response.data && error.response.data["o:errorDetails"]) {
            let detailMessage = error.response.data["o:errorDetails"][0]?.detail || "No detail available";
            msg.error = detailMessage;
            node.error("NetSuite Error Detail: " + detailMessage, msg);
        } else {
            msg.error = error.message;
        }

        node.send(msg);
    }
}

module.exports = function (RED) {
    function NetsuiteRestApiRequest(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        this.oauth = RED.nodes.getNode(config.oauth);

        node.on('input', async function (msg) {
            await executeRequest(node, config, msg);
        });
    }

    RED.nodes.registerType('netsuite-rest-api-request', NetsuiteRestApiRequest)};