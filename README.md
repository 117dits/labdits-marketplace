# LABDITS Marketplace

Build a complete, premium, frontend-only web application called **LABDITS — Digital Products & Interactive Web Experiences**.

IMPORTANT: I only have limited Lovable credits. Generate the complete frontend architecture, pages, components, responsive layouts, interactions, and animations in ONE implementation pass. Do not ask follow-up questions. Make reasonable decisions independently.

## 1. PRODUCT VISION

LABDITS is a premium digital marketplace where a fullstack developer sells ready-made websites, admin dashboards, SaaS applications, POS systems, landing pages, and other web applications.

The platform must feel like a combination of:
- A high-end fullstack developer portfolio
- A modern digital product marketplace
- A premium SaaS dashboard
- An interactive web application gallery

Visitors should be able to discover projects, explore features, interact with live demos, view pricing, and purchase source code or website packages.

The owner should have a private admin interface to manage products, upload project folders, configure demo URLs, set prices, and publish products.

**THIS PHASE IS STRICTLY FRONTEND ONLY.**

Do not create Supabase tables, backend APIs, authentication servers, cloud functions, payment integrations, or deployment infrastructure.

All functionality must be simulated using realistic mock data and frontend state. Prepare clean TypeScript interfaces and service abstractions for future Codex backend integration.

## 2. TECHNOLOGY STACK

Use:
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Motion / Framer Motion
- React Router
- Recharts for analytics
- Sonner for toast notifications

Use inspiration from 21st.dev, Magic UI, and Aceternity UI where practical, but avoid unnecessary dependencies.

Create reusable components with maintainable architecture.

## 3. DESIGN DIRECTION — EXTREMELY IMPORTANT

The interface must NOT look like a generic AI-generated SaaS template.

Design direction:
- Premium dark developer aesthetic
- Background: near-black charcoal (#09090B)
- Secondary surfaces: #111116 and #18181F
- Accent colors: electric indigo, violet, soft cyan
- Sophisticated gradients, used sparingly
- Elegant typography and excellent hierarchy
- Generous spacing
- Asymmetric bento layouts
- Subtle borders and layered depth
- High-quality product previews
- Modern cards with premium hover effects
- Professional, polished, distinctive visual identity

Typography:
- Geist or Inter for primary UI
- JetBrains Mono for technical metadata

Avoid:
- Generic three-card landing page
- Excessive glowing borders
- Random emojis
- Cyberpunk hacker aesthetics
- Fake terminal boot sequences
- Excessive glassmorphism
- Repetitive gradient cards
- Generic AI-generated hero sections

The final experience should feel like a real premium digital product startup.

## 4. BRAND IDENTITY

Brand name: LABDITS

Create a minimalist geometric LABDITS logo using SVG or CSS.

Tagline:
"Built to Impress. Ready to Deploy."

Supporting description:
"Premium websites, dashboards, and digital experiences. Explore interactive demos before making them yours."

Brand personality:
Creative, technical, confident, innovative, premium, and trustworthy.

## 5. PUBLIC LANDING PAGE

Route: /

Build a complete homepage with:

### Navigation
- LABDITS logo
- Explore Products
- Categories
- How It Works
- About
- Login
- Cart icon
- Mobile responsive navigation

Sticky navigation with elegant scroll effects.

### Hero Section
Create a visually exceptional hero.

Headline:
"Digital Experiences.
Built Beyond Ordinary."

Use beautiful typography with animated text reveals.

Include:
- Explore Products CTA
- Browse Live Demos CTA
- Animated product preview compositions
- Floating dashboard UI panels
- Subtle cursor-responsive movement
- Premium background grid or spotlight
- Animated statistics

Do not use a standard centered hero with a random illustration.

### Featured Products
Show featured products in a beautiful asymmetric bento grid.

Each product card includes:
- Actual-looking dashboard screenshot/mockup
- Product name
- Category
- Starting price in IDR
- Technology stack
- Live Demo button
- View Details button
- Premium / Popular badges where appropriate

### Product Categories
Include:
- Admin Dashboards
- Business Websites
- POS Systems
- SaaS Applications
- E-Commerce
- Landing Pages
- Custom Applications

### How It Works
1. Explore premium products
2. Try interactive demos
3. Choose a license or package
4. Purchase and receive access

### Why LABDITS
Highlight:
- Production-ready architecture
- Responsive design
- Modern technology
- Interactive previews
- Developer support
- Customization options

### Footer
Professional multi-column footer with brand, products, support, and social links.

## 6. PRODUCT MARKETPLACE

Route: /products

Create a premium product browsing experience.

Features:
- Search products
- Category filters
- Price range filters
- Technology filters
- Sort by newest, price, popularity
- Featured products
- Responsive product grid
- Animated transitions
- Product card skeleton loading
- Empty states

All filters and sorting must actually work with mock data.

## 7. PRODUCT DETAIL PAGE

Route: /products/:slug

Each product detail page should look like a professional software marketplace listing.

Include:
- Product title
- Large interactive screenshot gallery
- Product description
- Feature list
- Tech stack badges
- Version
- Last updated
- Responsive preview thumbnails
- Pricing packages
- What's included
- Installation requirements
- FAQ accordion
- Related products

Pricing packages:
1. Personal License
2. Commercial License
3. Installation + Customization

Include:
- Try Live Demo
- Buy Now
- Add to Cart
- Contact Developer

## 8. INTERACTIVE DEMO EXPERIENCE

Route: /demo/:slug

This is one of the MOST IMPORTANT features.

Create a professional demo viewer interface.

The demo viewer must include:
- LABDITS branded toolbar
- Product name
- Desktop preview button
- Tablet preview button
- Mobile preview button
- Refresh preview button
- Fullscreen button
- Open external demo button
- Back to product button
- Buy this project CTA

Create a responsive iframe-based preview container.

For mock projects without deployed demo URLs, display an attractive interactive mock demo interface instead of a broken iframe.

When a demo URL is available, support embedding through iframe where permitted.

If a website blocks iframe embedding, provide an external demo fallback.

Device viewport switching must visually work.

## 9. SHOPPING CART & CHECKOUT

Routes:
- /cart
- /checkout
- /checkout/success

Cart features:
- Add and remove products
- Select license type
- Quantity where appropriate
- Subtotal
- Order summary
- Checkout CTA

Checkout UI:
- Customer name
- Email
- WhatsApp number
- Selected products
- License details
- Order summary
- Payment method selector

Display payment options:
- QRIS
- Virtual Account
- E-Wallet
- Bank Transfer

IMPORTANT:
These are frontend simulations only. Never collect actual payment credentials or display a fake successful real payment.

Use clearly labeled demo payment states.

## 10. CUSTOMER DASHBOARD

Routes:
- /account
- /account/orders
- /account/downloads
- /account/settings

Create a customer dashboard with:
- Purchased products
- Order history
- Payment status
- Downloadable product cards
- License information
- Support access

Use mock authentication state.

## 11. OWNER ADMIN DASHBOARD

Routes:
- /admin
- /admin/products
- /admin/products/new
- /admin/products/:id/edit
- /admin/orders
- /admin/customers
- /admin/analytics
- /admin/settings

Create a sophisticated premium admin interface.

Design:
- Beautiful collapsible sidebar
- Compact top navigation
- Smooth transitions
- Elegant analytics cards
- Recharts analytics
- Recent orders
- Revenue overview
- Product performance
- Quick actions

### Admin Overview
Show:
- Total revenue
- Total products
- Total orders
- Total customers
- Conversion rate
- Sales chart
- Top selling products
- Recent transactions

### Product Management
Create a complete interactive CRUD interface using mock state.

Features:
- Add product
- Edit product
- Delete product with confirmation
- Publish/unpublish product
- Draft products
- Featured products
- Search and filter
- Product status

### Add New Product
Build a beautiful multi-step product creation form.

Step 1: Basic Information
- Product name
- Slug
- Category
- Description
- Tech stack
- Features

Step 2: Project Files
- Drag-and-drop folder/ZIP upload interface
- Selected file list
- Upload progress simulation
- File validation feedback
- Project thumbnail upload

IMPORTANT:
Do not actually upload or deploy source code.
Simulate the upload UI and mark it as pending backend integration.

Step 3: Demo Configuration
- Demo URL
- Demo preview mode
- Desktop/tablet/mobile support
- Demo login credentials fields for public test accounts
- Demo availability status

Step 4: Pricing
- Personal license price
- Commercial license price
- Custom installation price
- Discount price
- Free demo availability

Use Indonesian Rupiah formatting.

Step 5: Publish
- Product preview
- Draft / Published status
- Featured toggle
- Publish confirmation

Publishing should immediately update the public marketplace using shared frontend mock state.

### Orders
Include:
- Order table
- Customer details
- Payment status
- Order status
- Product purchased
- Date
- Order detail drawer

### Customers
Include:
- Customer table
- Purchase history
- Account status
- Search

### Analytics
Include:
- Revenue chart
- Product views
- Demo interactions
- Conversion metrics
- Top products
- Date filters

### Settings
Include:
- Store profile
- Brand settings
- Social links
- Payment gateway configuration UI (placeholder)
- General preferences

## 12. REALISTIC DEMO PRODUCTS

Seed the interface with polished mock products such as:

1. FinanceFlow — Financial Management Dashboard
2. RetailPOS — Modern Point of Sale System
3. EventSphere — Event Ticketing Platform
4. CommerceKit — E-Commerce Admin Dashboard
5. TaskPilot — Project Management SaaS
6. Sakinah — Digital Wedding Invitation Platform

Use believable descriptions, feature sets, and illustrative prices.

Ensure demo products look like actual premium software products, not empty placeholder cards.

## 13. ANIMATION SYSTEM

Animations are a major priority.

Implement:
- Smooth page transitions
- Staggered text reveal
- Scroll-triggered section reveals
- Magnetic-feeling buttons
- Animated hover cards
- Subtle card tilt
- Animated gradient highlights
- Smooth filter transitions
- Modal entrance/exit
- Sidebar animations
- Animated counters
- Tab transitions
- Image gallery transitions
- Smooth mobile navigation

Animation principles:
- Premium and restrained
- Smooth 60fps where possible
- Prefer transform and opacity
- Respect prefers-reduced-motion
- Avoid excessive visual noise
- Avoid animations that delay user interactions

## 14. RESPONSIVE DESIGN

Perfectly optimize for:
- 360px
- 390px
- 430px
- 768px
- 1024px
- 1440px

No horizontal overflow.

Create a genuinely thoughtful mobile experience rather than shrinking the desktop layout.

## 15. FRONTEND ARCHITECTURE

Organize code into:

src/
- components/
- components/ui/
- components/layout/
- components/products/
- components/demo/
- components/admin/
- pages/
- pages/admin/
- hooks/
- services/
- data/
- types/
- lib/

Create:
- Product types
- Order types
- Customer types
- License types
- Mock data
- Mock service layer
- Reusable components

Use frontend local state and localStorage where appropriate for demo persistence.

Keep backend integration points clearly separated.

## 16. FUTURE CODEX BACKEND READINESS

The future backend will handle:
- Secure authentication and roles
- Database persistence
- Project ZIP uploads
- Source code storage
- Automated deployment/build pipelines
- Demo hosting
- Payment gateway integration
- Webhooks
- Order verification
- Secure file downloads
- License management
- Customer management
- Analytics

Do NOT implement these backend services now.

Use clearly defined mock service methods that Codex can replace later.

## 17. QUALITY REQUIREMENTS

- No broken navigation
- No empty major pages
- No nonfunctional primary buttons
- All mock CRUD actions must work
- Filters must work
- Cart interactions must work
- Device preview switching must work
- Publishing must update public mock listings
- Professional loading and empty states
- Accessibility-friendly interactions
- Responsive on desktop and mobile
- Clean TypeScript code

## FINAL INSTRUCTION

Build LABDITS as a complete, premium, visually distinctive frontend prototype.

Prioritize excellent visual execution and working frontend interactions over unnecessary complexity.

Do not connect any backend or Supabase.

Do not stop at a landing page. Implement the marketplace, product details, demo viewer, cart, checkout, customer area, and admin management experience.

Make LABDITS feel like a real premium developer-owned software marketplace ready for future backend integration by Codex.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6e9e7b79-3d29-402c-8153-f1aa77f3edd7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
