# Node-RED NetSuite Integration

A collection of Node-RED nodes to interact with NetSuite using OAuth 1.0 authentication and the REST API.

## Features

- OAuth 1.0 authentication configuration for NetSuite
- REST API requests to NetSuite records
- SuiteQL API requests for advanced querying

## Prerequisites

- Node-RED installed and running
- NetSuite account with REST Web Services enabled
- NetSuite Integration Record with OAuth 1.0 credentials

## Nodes

### NetSuite OAuth Config

This configuration node stores NetSuite OAuth 1.0 credentials required for authenticating with the NetSuite REST API.

#### Configuration

| Parameter | Description |
|-----------|-------------|
| Name | A name for this configuration |
| Consumer Key | OAuth Consumer Key from NetSuite Integration Record |
| Consumer Secret | OAuth Consumer Secret from NetSuite Integration Record |
| Token | OAuth Token from NetSuite Integration Record |
| Token Secret | OAuth Token Secret from NetSuite Integration Record |
| OAuth Realm | NetSuite Account ID (e.g., 888063_SB1) |

#### Setup

1. In Node-RED, add a new "NetSuite OAuth Config" node
2. Enter your NetSuite OAuth credentials
3. Click "Add" to save the configuration

This shared configuration can be used by other NetSuite nodes in your flows.

### NetSuite REST API Request

This node allows you to perform CRUD operations against NetSuite records using the REST API.

#### Configuration

| Parameter | Description |
|-----------|-------------|
| Name | A name for this node |
| OAuth Config | Select your NetSuite OAuth configuration |
| HTTP Method | Select GET, POST, PUT, PATCH, or DELETE |
| URL | Base URL for the NetSuite REST API (https://[accountid].suitetalk.api.netsuite.com/services/rest/record/v1) |
| NetSuite Object | Select the NetSuite record type to interact with (e.g., customer, invoice, etc.) |
| Limit | Maximum number of records to return (for GET requests) |
| Offset | Starting offset for pagination (for GET requests) |
| ID of the object | Internal ID of the record (for GET, PATCH, DELETE operations) |
| External ID of the object | External ID of the record (for PUT operations) |
| Body | JSON body for POST, PUT, and PATCH operations |

#### Input

The node can be configured either through the node configuration or dynamically via `msg` properties:

- `msg.payload.url` - Overrides the configured URL
- `msg.payload.method` - Overrides the configured HTTP method
- `msg.payload.netsuiteobject` - Overrides the configured NetSuite object
- `msg.payload.limit` - Overrides the configured limit
- `msg.payload.offset` - Overrides the configured offset
- `msg.payload.objectid` - Overrides the configured internal ID
- `msg.payload.objectexternalid` - Overrides the configured external ID
- `msg.payload.bodyNetsuite` - Overrides the configured body

#### Output

- `msg.payload.data` - Contains the response data from NetSuite
- `msg.payload.headers` - Contains the response headers
- `msg.payload.statusCode` - Contains the HTTP status code
- `msg.error` - Contains error details if the request fails

#### HTTP Method Usage

- **GET**: Retrieve records. Use with limit/offset for lists or objectid for single records
- **POST**: Create new records. Requires a valid JSON body
- **PUT**: Update records with external ID. Requires both objectexternalid and a valid JSON body
- **PATCH**: Update specific fields of a record. Requires objectid and a valid JSON body
- **DELETE**: Delete a record. Requires objectid



### NetSuite SuiteQL API Request

This node allows you to run SuiteQL queries against the NetSuite API.

#### Configuration

| Parameter | Description |
|-----------|-------------|
| OAuth Config | Select your NetSuite OAuth configuration |
| URL | The SuiteQL endpoint URL (https://[accountid].suitetalk.api.netsuite.com/services/rest/query/v1/suiteql) |
| Body | The SuiteQL query body in JSON format |

#### Input

The node can be configured either through the node configuration or dynamically via `msg` properties:

- `msg.url` - Overrides the configured URL (optional)
- `msg.payload.body` - Overrides the configured body (optional)

#### Output

- `msg.payload` - Contains the response data from NetSuite
- `msg.error` - Contains error details if the request fails

#### SuiteQL Query Format

SuiteQL queries should be formatted in the body as:

{
  "q": "SELECT id, entityid FROM customer WHERE companyname LIKE 'A%'"
}




## URL Structure

- **REST API Base URL**: `https://[accountid].suitetalk.api.netsuite.com/services/rest/record/v1`
- **SuiteQL API URL**: `https://[accountid].suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`

Replace `[accountid]` with your NetSuite account ID.

## Error Handling

Both nodes include error handling that captures and reports NetSuite API errors:

- NetSuite error details are included in the `msg.error` property
- Error status is displayed in the node status indicator in the Node-RED editor
- Detailed error information is logged to the Node-RED debug console

## Dependencies

- axios: For HTTP requests
- crypto: For OAuth signature generation

