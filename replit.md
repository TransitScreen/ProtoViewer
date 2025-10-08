# Protobuf Decoder Web Application

A beautiful, production-ready web application for decoding protobuf feeds using custom bindings files with advanced features including multiple output formats, decode history, and real-time streaming.

## Features

- **Dual Bindings Input**: Upload .proto files via drag-and-drop OR fetch them from URLs
- **Message Type Selection**: Automatically discover and select from available message types in your protobuf schema
- **Feed Decoding**: Decode protobuf feeds from any URL with proper error handling
- **Multiple Output Formats**: Export decoded data as JSON, XML, or human-readable text
- **Download Capability**: Download decoded output with automatic file naming based on format
- **Decode History**: localStorage-based session history with ability to view and restore previous decodes
- **Real-time Streaming**: WebSocket-powered continuous feed decoding with configurable update intervals
- **Beautiful UI**: Material Design-inspired interface with dark mode support

## How to Use

### Basic Decode

1. **Provide Protobuf Bindings**:
   - **Option A**: Upload a .proto file using drag-and-drop or file picker
   - **Option B**: Enter a URL to your .proto file

2. **Load Message Types** (Optional):
   - Click the refresh button to fetch available message types from your bindings
   - Select the appropriate message type from the dropdown
   - Or manually enter a message type name

3. **Enter Feed URL**:
   - Provide the URL of the protobuf feed you want to decode

4. **Choose Output Format**:
   - Select from JSON, XML, or Text format
   - Format can be changed after decoding

5. **Decode**:
   - Click "Decode Once" button for single decode
   - View the decoded output in the text area below
   - Download or copy output to clipboard

### Real-time Streaming

1. Configure your bindings and feed URL as usual
2. Set the update interval (100ms - 10000ms)
3. Toggle the "Real-time Streaming" switch
4. Watch live updates as the feed is continuously decoded
5. Toggle off to stop streaming

### History Management

1. Click the "History" button in the header to view past sessions
2. Click on any history item to restore that decode session
3. History shows: timestamp, format, decode time, feed URL, and message type
4. Clear all history with the "Clear All" button
5. History is stored locally and persists across browser sessions (up to 50 items)

## Technical Details

### Stack
- Frontend: React + TypeScript + Tailwind CSS + Shadcn UI
- Backend: Express.js + protobufjs + WebSocket (ws)
- File uploads: Multer
- HTTP client: Axios
- Data conversion: xml-js for XML output

### API Endpoints
- `POST /api/message-types` - Get available message types from bindings
- `POST /api/decode` - Decode protobuf feed with format support (JSON/XML/Text)
- `WS /ws/stream` - WebSocket endpoint for real-time streaming decode

### Features Implemented
- Recursive namespace and nested message type discovery
- Support for complex .proto files with packages and nested structures
- Multiple output format conversion (JSON, XML, human-readable text)
- File download with automatic format-based naming
- localStorage-based decode history (last 50 sessions)
- WebSocket streaming with configurable interval updates
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

## Recent Updates (Latest Session)

### New Features Added
1. **Multiple Output Formats**: 
   - Added JSON, XML, and human-readable text output formats
   - Format selector with live preview
   - Backend conversion logic for all formats

2. **Download Functionality**:
   - Download button for exporting decoded output
   - Automatic file naming with timestamp and format extension
   - Supports all output formats (JSON, XML, TXT)

3. **Decode History**:
   - localStorage-based session history
   - Stores last 50 decode sessions
   - Sidebar panel with history list
   - Click to restore previous sessions
   - Shows timestamp, format, decode time, feed URL, and message type
   - Clear all functionality

4. **Real-time Streaming**:
   - WebSocket-powered continuous decoding
   - Configurable update interval (100ms - 10000ms)
   - Toggle switch to start/stop streaming
   - Live output updates
   - Proper WebSocket cleanup on disconnect

### Previous Updates
- Fixed recursive message type collection to handle packages and nested message structures
- Added message type selection UI with automatic type loading
- Improved error messages with available types listing
- Added state clearing when bindings source changes to prevent stale data
