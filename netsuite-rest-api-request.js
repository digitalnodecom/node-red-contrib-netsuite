const crypto = require('crypto');
const axios = require('axios');

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

    const baseUrl = url.split('?')[0];

    return [
        method.toUpperCase(),
        encodeURIComponent(baseUrl),
        encodeURIComponent(paramString)
    ].join('&');
}

function generateAuthHeader(node, method, url, queryParams = {}) {
    const realm = node.oauth.realm ;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    let oauthParams = {
        oauth_consumer_key: node.oauth.consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp,
        oauth_token: node.oauth.token,
        oauth_version: '1.0'
    };

    // Convert URLSearchParams to plain object
    const plainQueryParams = {};
    if (queryParams instanceof URLSearchParams) {
        for (const [key, value] of queryParams) {
            plainQueryParams[key] = value;
        }
    } else {
        Object.assign(plainQueryParams, queryParams);
    }

    const baseString = generateBaseString(method, url, oauthParams, plainQueryParams);
    const signingKey = `${encodeURIComponent(node.oauth.consumerSecret)}&${encodeURIComponent(node.oauth.tokenSecret)}`;
    const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');

    // **Construct OAuth Header**
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
        const url = config.url || msg.payload.url;
        const method = config.method || msg.payload.method;
        const netsuiteobject = config.netsuiteobject || msg.payload.netsuiteobject;
        const limit = config.limit || msg.payload.limit;
        const offset = config.offset || msg.payload.offset;
        const objectid = config.objectid || msg.payload.objectid;
        const bodyNetsuite = config.bodyNetsuite || msg.payload.bodyNetsuite;
        const objectexternalid = config.objectexternalid || msg.payload.objectexternalid;


        if (!url) {
            throw new Error("The URL is missing. Please provide a valid URL.");
        }
        if (!node.oauth || !node.oauth.consumerKey || !node.oauth.consumerSecret || !node.oauth.token || !node.oauth.tokenSecret) {
            throw new Error("OAuth credentials are missing or incomplete.");
        }

        let finalUrl = url;
        if (netsuiteobject) {
            finalUrl += `/${netsuiteobject}`;
        }
        if (objectid) {
            finalUrl += `/${objectid}`;
        }
        if(objectexternalid){
            finalUrl += `/eid:${objectexternalid}`;
        }

        let queryParams = new URLSearchParams();
        if (limit) queryParams.append("limit", limit);
        if (offset) queryParams.append("offset", offset);

        const authHeader = generateAuthHeader(node, method, finalUrl, queryParams);

        if (queryParams.toString()) {
            finalUrl += `?${queryParams.toString()}`;
        }
        
        const requestOptions = {
            method: method.toUpperCase(),
            url: finalUrl,
            headers: {
                'Authorization': authHeader,
            },
            data: bodyNetsuite ? JSON.parse(bodyNetsuite) : null,
        };
       

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

    RED.nodes.registerType('netsuite-rest-api-request', NetsuiteRestApiRequest);
};
