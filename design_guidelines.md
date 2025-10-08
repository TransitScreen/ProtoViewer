# Protobuf Decoder Web Application - Design Guidelines

## Design Approach

**System Selected**: Material Design with developer tool optimizations
**Rationale**: This is a utility-focused developer tool requiring efficiency, clarity, and learnability. Material Design provides excellent patterns for forms, data display, and structured workflows while maintaining a clean, professional aesthetic suitable for technical users.

**Key Principles**:
- Clarity over decoration: Every element serves a functional purpose
- Progressive disclosure: Guide users through the decode workflow step-by-step
- Technical precision: Communicate status, errors, and data clearly
- Efficiency-first: Minimize clicks and friction in the decode process

---

## Core Design Elements

### A. Color Palette

**Light Mode**:
- Background: 210 20% 98% (subtle cool gray)
- Surface: 0 0% 100% (pure white for cards)
- Primary: 217 91% 60% (professional blue for actions)
- Success: 142 71% 45% (green for successful decodes)
- Error: 0 84% 60% (red for validation/decode errors)
- Text Primary: 220 13% 18%
- Text Secondary: 215 14% 34%

**Dark Mode**:
- Background: 222 47% 11%
- Surface: 217 33% 17%
- Primary: 217 91% 70%
- Success: 142 71% 55%
- Error: 0 84% 70%
- Text Primary: 210 20% 98%
- Text Secondary: 217 20% 70%

### B. Typography

**Font Family**: 
- Primary: 'Inter', system-ui, sans-serif (via Google Fonts)
- Monospace: 'JetBrains Mono', 'Fira Code', monospace (for code/output display)

**Scale**:
- H1 (Page title): 2rem, font-weight 700
- H2 (Section headers): 1.5rem, font-weight 600
- H3 (Card titles): 1.125rem, font-weight 600
- Body: 0.875rem, font-weight 400
- Code/Output: 0.8125rem, font-weight 400, monospace
- Labels: 0.75rem, font-weight 500, uppercase, letter-spacing 0.5px

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, and 16 for consistent rhythm
- Component padding: p-6
- Section spacing: space-y-8
- Form field spacing: space-y-4
- Inline element gaps: gap-4

**Container Structure**:
- Max width: max-w-6xl
- Horizontal padding: px-4 md:px-8
- Centered: mx-auto

---

## D. Component Library

### Navigation/Header
- Minimal fixed header with app title and theme toggle
- Height: h-16
- Shadow: subtle bottom border (border-b)
- Layout: flex justify-between items-center

### Input Section Cards
Create three distinct workflow cards arranged horizontally on desktop (grid-cols-1 lg:grid-cols-3):

**1. Bindings Input Card**:
- Tabbed interface for File Upload vs URL Input
- Tab styling: rounded-t-lg, active state with primary color bottom border
- File upload: Drag-and-drop zone with dashed border, hover state
- URL input: Full-width text field with validation icon
- Visual feedback: Show filename/URL when loaded with checkmark icon

**2. Feed URL Card**:
- Single focused input field
- Label: "Protobuf Feed URL"
- Input: Large text field with placeholder
- Validation: Real-time URL format checking
- Icon: Link icon prefix

**3. Decode Action Card**:
- Prominent "Decode Protobuf" button (primary color, full-width)
- Status indicator area showing:
  - Idle state: Instructions
  - Loading state: Spinner with "Fetching & decoding..."
  - Success state: Checkmark with decode time
  - Error state: Error icon with message
- Button disabled state when bindings/URL not provided

### Output Display
- Full-width text area below input cards
- Height: min-h-96 (scrollable for long output)
- Background: Surface color with slight contrast
- Font: Monospace for JSON output
- Features:
  - Syntax highlighting for JSON (use a lightweight library)
  - Line numbers in gutter
  - Copy to clipboard button (top-right corner)
  - Word wrap toggle
- Empty state: Centered placeholder with icon and instructions

### Form Elements
- Text inputs: Border-2, rounded-lg, focus:ring-2 focus:ring-primary
- Buttons: rounded-lg, px-6 py-3, shadow-sm
- File upload zone: min-h-32, rounded-lg, border-2 border-dashed, transition on hover/drag

### Icons
Use Heroicons (outline style) via CDN:
- Upload: cloud-arrow-up
- Link: link
- Check: check-circle
- Error: exclamation-circle
- Copy: clipboard-document
- Code: code-bracket

---

## Layout Structure

**Single Page Application Layout**:

1. **Header** (h-16, sticky top-0):
   - Left: App title "Protobuf Decoder" with icon
   - Right: Dark mode toggle

2. **Main Content Area** (py-12):
   - **Workflow Section** (mb-8):
     - 3-column grid (responsive: stack on mobile)
     - Equal height cards with subtle shadows
     - Connected with visual flow indicators (optional arrows/lines)
   
   - **Output Section**:
     - Section header with title and actions
     - Large text area for decoded output
     - Stats bar below (items decoded, decode time)

3. **Footer** (py-6, border-t):
   - Minimal: Links to documentation, GitHub
   - Centered text-sm text-secondary

---

## Interaction Patterns

**File Upload Flow**:
- Drag-over state: Increase border color opacity, show "Drop to upload" text
- File selected: Show filename with size, green checkmark
- Replace: X button to clear and reupload

**URL Input Flow**:
- Focus state: Blue ring, slight scale up
- Valid URL: Green checkmark icon appears
- Invalid URL: Red X icon with error message below

**Decode Process**:
1. User provides bindings (file or URL) → Card shows confirmation
2. User enters feed URL → Validation passes
3. Decode button activates (from disabled gray to primary blue)
4. Click decode → Button shows loading spinner
5. Success → Output appears with smooth fade-in animation
6. Error → Error message in output area with retry button

**Error States**:
- Inline validation errors below inputs (text-sm text-error)
- Toast notifications for network errors (top-right corner)
- Output area error display with detailed stack trace (expandable)

---

## Responsive Behavior

**Desktop (lg+)**: 3-column workflow cards, wide output area
**Tablet (md)**: 2-column cards (bindings + feed URL side-by-side), action card below
**Mobile**: Single column stack, maintain touch-friendly button sizes (min-h-12)

---

## Images

No hero images needed. This is a focused utility application where functionality takes precedence. Use icons strategically to indicate states and actions throughout the interface.