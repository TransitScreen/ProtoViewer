# Protobuf Decoder Web Application

A beautiful, production-ready web application for decoding protobuf feeds using custom bindings files.

## Features

- **Dual Bindings Input**: Upload .proto files via drag-and-drop OR fetch them from URLs
- **Message Type Selection**: Automatically discover and select from available message types in your protobuf schema
- **Feed Decoding**: Decode protobuf feeds from any URL with proper error handling
- **Beautiful UI**: Material Design-inspired interface with dark mode support
- **JSON Output**: Formatted, copy-to-clipboard JSON output of decoded protobuf data

## How to Use

1. **Provide Protobuf Bindings**:
   - **Option A**: Upload a .proto file using drag-and-drop or file picker
   - **Option B**: Enter a URL to your .proto file

2. **Load Message Types** (Optional):
   - Click the refresh button to fetch available message types from your bindings
   - Select the appropriate message type from the dropdown
   - Or manually enter a message type name

3. **Enter Feed URL**:
   - Provide the URL of the protobuf feed you want to decode

4. **Decode**:
   - Click "Decode Protobuf" button
   - View the decoded JSON output in the text area below
   - Copy output to clipboard if needed

## Technical Details

### Stack
- Frontend: React + TypeScript + Tailwind CSS + Shadcn UI
- Backend: Express.js + protobufjs
- File uploads: Multer
- HTTP client: Axios

### API Endpoints
- `POST /api/message-types` - Get available message types from bindings
- `POST /api/decode` - Decode protobuf feed

### Features Implemented
- Recursive namespace and nested message type discovery
- Support for complex .proto files with packages and nested structures
- Comprehensive error handling and validation
- Dark/light theme with localStorage persistence
- Responsive design for mobile and desktop
- Beautiful loading and error states

## Architecture

The application uses a stateless request/response model with no database requirement. All protobuf decoding happens in-memory on the server.

### Frontend Structure
- Single page application at `/`
- Theme provider with dark mode support
- React Query for API state management
- Shadcn UI components for consistent design

### Backend Logic
- Fetches bindings from files or URLs
- Recursively discovers all message types (including nested)
- Attempts automatic decoding or uses specified message type
- Returns formatted JSON with decode timing information

## Recent Updates

- Fixed recursive message type collection to handle packages and nested message structures
- Added message type selection UI with automatic type loading
- Improved error messages with available types listing
- Added state clearing when bindings source changes to prevent stale data
