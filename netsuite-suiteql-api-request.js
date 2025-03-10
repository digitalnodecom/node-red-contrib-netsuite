const crypto = require('crypto');
const axios = require('axios');

function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

function generateBaseString(method, url, params) {
    const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
            acc[key] = params[key].toString();
            return acc;
        }, {});

    const paramString = Object.entries(sortedParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    return [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(paramString)
    ].join('&');
}

async function executeRequest(node, config, msg) {
    try {
        const url = config.url || msg.url;
        const method = 'POST';
        const realm = node.oauth.realm ;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = generateNonce();

        if (!url) {
            throw new Error('The URL is missing. Please provide a valid URL.');
        }
        if (!node.oauth.token || !node.oauth.tokenSecret) {
            throw new Error('Missing token or tokenSecret.');
        }

        const oauthParams = {
            oauth_consumer_key: node.oauth.consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA256',
            oauth_timestamp: timestamp,
            oauth_token: node.oauth.token,
            oauth_version: '1.0'
        };

        const baseString = generateBaseString(method, url, oauthParams);
        const signingKey = `${encodeURIComponent(node.oauth.consumerSecret)}&${encodeURIComponent(node.oauth.tokenSecret)}`;
        const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');

        const authHeader = 'OAuth ' + [
            `realm="${encodeURIComponent(realm)}"`,
            `oauth_consumer_key="${encodeURIComponent(node.oauth.consumerKey)}"`,
            `oauth_token="${encodeURIComponent(node.oauth.token)}"`,
            `oauth_signature_method="HMAC-SHA256"`,
            `oauth_timestamp="${encodeURIComponent(timestamp)}"`,
            `oauth_nonce="${encodeURIComponent(nonce)}"`,
            `oauth_version="1.0"`,
            `oauth_signature="${encodeURIComponent(signature)}"`
        ].join(', ');

        const requestOptions = {
            method: method,
            url: url,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Prefer': 'transient'
            },
            data: config.body || msg.payload.body
        };

        const response = await axios(requestOptions);
        msg.payload = response.data;
        node.status({ fill: "green", shape: "dot", text: "success" });
        node.send(msg);
    } catch (error) {
        node.status({ fill: "red", shape: "ring", text: error.message });
        node.error("NetSuite Error: " + error.message);
        msg.error = error.response ? {
            message: error.message,
            status: error.response.status,
            data: error.response.data
        } : error;
        node.send(msg);
    }
}

module.exports = function (RED) {
    function NetSuiteSuiteQLAPIRequest(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        this.oauth = RED.nodes.getNode(config.oauth);

        node.on('input', async function (msg) {
            await executeRequest(node, config, msg);
        });
    }

    RED.nodes.registerType('netsuite-suiteql-api-request', NetSuiteSuiteQLAPIRequest);
};
