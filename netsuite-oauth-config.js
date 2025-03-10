module.exports = function(RED) {
    function NetSuiteOAuthConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.consumerKey = config.consumerKey;
        this.consumerSecret = config.consumerSecret;
        this.token = config.token;
        this.tokenSecret = config.tokenSecret;
        this.realm = config.realm;
    }
    RED.nodes.registerType("netsuite-oauth-config", NetSuiteOAuthConfigNode);
}
