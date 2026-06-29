# Frequently Asked Questions (FAQ)

### Can I use Write Your Thoughts entirely offline?
Yes! The application relies on a local SQLite database for all its core functions. You can create books, write chapters, and build your world completely without an internet connection.

### How does cloud sync work if I'm offline?
When you make changes offline, the app stores those changes in a local queue. The moment your computer reconnects to the internet, the background sync engine securely pushes that queue to your Supabase cloud.

### Do I lose my original text when the AI polishes a paragraph?
Never. Write Your Thoughts has a strict non-destructive philosophy. When the AI polishes text, it generates suggestions in a side panel. You must explicitly accept the change, and even then, your version history retains your original draft.

### What AI providers do you support?
We currently support OpenAI (ChatGPT), Anthropic (Claude), and Google Gemini. You can switch between them seamlessly in the Settings menu.

### How is my data kept private?
Your cloud data is protected by Supabase Row Level Security (RLS). You can only access rows in the database that match your authenticated User ID. Furthermore, the AI features only send the necessary snippet of text you select, keeping your overall manuscript private unless explicitly analyzed.

### Can I collaborate with a co-author?
Collaboration is on our roadmap. Currently, the architecture handles single-user multi-device sync perfectly. Simultaneous multiplayer editing (like Google Docs) is not yet supported.

### Where is the local database stored?
The local SQLite file is typically located in your OS-specific application data folder:
- **Windows**: `%APPDATA%\write-your-thoughts\database\write-your-thoughts.db`
- **macOS**: `~/Library/Application Support/write-your-thoughts/database/write-your-thoughts.db`
- **Linux**: `~/.config/write-your-thoughts/database/write-your-thoughts.db`
