# Firebase MCP Server Documentation

## Overview

This document provides instructions on how to interact with the Firebase MCP (Model-Context Protocol) Server. This server exposes a suite of Firebase management tools, allowing an AI assistant or other MCP clients to manage your Firebase project programmatically. It provides a powerful way to automate development, deployment, and operational tasks.

## Connecting to the Server

The Firebase MCP Server communicates using standard I/O (`stdio`). To interact with it, you need an MCP client. This could be a dedicated client application, a custom script, or an extension in your IDE, such as a VS Code extension designed for MCP communication.

The client sends JSON-RPC 2.0 requests to the server's standard input and receives responses on its standard output.

## Available Tools

The server provides a range of tools to manage different aspects of your Firebase project. Here are the primary tools available:

### General Project Management
*   `firebase_project_info`: Retrieves information and configuration for the current Firebase project.

### Cloud Functions
*   `firebase_deploy_functions`: Deploys Firebase Cloud Functions. You can specify which functions to deploy or deploy all of them.
*   `firebase_functions_logs`: Fetches logs for your Cloud Functions.

### Firestore
*   `firebase_firestore_query`: Executes queries against your Firestore database with support for advanced filtering and ordering.

### Firebase Authentication
*   `firebase_auth_create_user`: Creates a new user in Firebase Authentication.
*   `firebase_auth_list_users`: Lists existing users.
*   `firebase_auth_delete_user`: Deletes a user by their UID or email.
*   `firebase_auth_update_user`: Updates a user's properties.
*   `firebase_auth_search_user`: Searches for a user by email or phone number.
*   `firebase_auth_set_custom_claims`: Sets custom claims for a user.
*   `firebase_auth_get_custom_claims`: Retrieves custom claims for a user.
*   `firebase_auth_remove_custom_claims`: Removes custom claims from a user.
*   `firebase_auth_disable_user`: Disables a user account.
*   `firebase_auth_enable_user`: Enables a user account.
*   `firebase_auth_send_password_reset`: Sends a password reset email to a user.
*   `firebase_auth_send_email_verification`: Sends an email verification link to a user.
*   `firebase_auth_bulk_create_users`: Creates multiple users in a single operation.
*   `firebase_auth_bulk_delete_users`: Deletes multiple users in a single operation.
*   `firebase_auth_export_users`: Exports all users to a file.
*   `firebase_auth_import_users`: Imports users from a file.

### Firebase Storage
*   `firebase_storage_upload_file`: Uploads a local file to Firebase Storage.
*   `firebase_storage_upload_from_url`: Uploads a file from a URL to Firebase Storage.
*   `firebase_storage_bulk_upload`: Uploads multiple files in a single operation.
*   `firebase_storage_download_file`: Downloads a file from Firebase Storage.
*   `firebase_storage_get_download_url`: Gets a publicly accessible URL for a file.
*   `firebase_storage_get_file_metadata`: Retrieves metadata for a file.
*   `firebase_storage_delete_file`: Deletes a file from Storage.
*   `firebase_storage_list_files`: Lists files in a Storage bucket.
*   `firebase_storage_move_file`: Moves or renames a file in Storage.
*   `firebase_storage_update_metadata`: Updates the metadata of a file.
*   `firebase_storage_get_bucket_info`: Retrieves information about a Storage bucket.
*   `firebase_storage_create_bucket`: Creates a new Storage bucket.
*   `firebase_storage_batch_operations`: Performs multiple Storage operations in a single request.
*   `firebase_storage_validate_file`: Validates a file's integrity and metadata.

### Firebase Hosting
*   `firebase_hosting_deploy`: Deploys your site to Firebase Hosting.
*   `firebase_hosting_deploy_channel`: Deploys to a specific hosting channel.
*   `firebase_hosting_deploy_target`: Deploys to a specific hosting target.
*   `firebase_hosting_list_sites`: Lists all hosting sites in the project.
*   `firebase_hosting_list_channels`: Lists all deployment channels for a site.
*   `firebase_hosting_delete_channel`: Deletes a hosting channel.
*   `firebase_hosting_get_config`: Retrieves the `firebase.json` hosting configuration.
*   `firebase_hosting_domains_list`: Lists all domains associated with your hosting sites.
*   `firebase_hosting_domains_add`: Adds a new domain to a hosting site.
*   `firebase_hosting_domains_delete`: Deletes a domain from a hosting site.
*   `firebase_hosting_init`: Initializes Firebase Hosting in the project directory.
*   `firebase_hosting_status`: Checks the status of your hosting deployment.
*   `firebase_hosting_serve`: Starts a local server for testing your hosting setup.
*   `firebase_hosting_rewrite_list`: Lists all rewrites in your hosting configuration.
*   `firebase_hosting_rewrite_add`: Adds a new rewrite rule.
*   `firebase_hosting_headers_add`: Adds a new header rule.
*   `firebase_hosting_ssl_certificates`: Manages SSL certificates for your domains.

### Security Rules
*   `firebase_rules_deploy`: Deploys Firestore and Storage security rules.

### Local Development
*   `firebase_emulators_start`: Starts the Firebase emulators for local development and testing.

## Example Usage

To invoke a tool, the client sends a JSON-RPC request to the server. Here is an example of how to call the `firebase_project_info` tool to get information about the current project.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/firebase_project_info",
  "params": {},
  "id": 1
}
```

**Response (Example):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"currentProject\": \"mi-rosarita-ai-app\",\n  \"projects\": [\n    {\n      \"projectId\": \"mi-rosarita-ai-app\",\n      \"projectNumber\": \"123456789012\",\n      \"displayName\": \"Mi Rosarita AI App\",\n      \"state\": \"ACTIVE\"\n    }\n  ]\n}"
      }
    ]
  },
  "id": 1
}
```

This simple request-response pattern is used for all available tools, with the `params` object changing based on the requirements of the specific tool being called.