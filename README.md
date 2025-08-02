# 🦄 uniter.sh - Unified DeFi Terminal

**Make tokens unitETH with 1inch!**

A powerful, cross-platform DeFi portfolio scanner that works in both CLI and web environments. Scan your multi-chain token holdings, get real-time USD valuations, and manage your DeFi portfolio with a beautiful terminal interface.

## ✨ Features

### 🌐 **Cross-Platform Support**
- **CLI Terminal**: Full-featured command-line interface for power users
- **Web Terminal**: Browser-based terminal with professional UX
- **Unified Codebase**: Same scanning logic and display across all environments

### 🔗 **Multi-Chain Portfolio Scanning**
- **12+ Supported Chains**: Ethereum, Base, Arbitrum, Polygon, Avalanche, BNB Chain, Optimism, ZKsync Era, Linea, Gnosis, Sonic, Unichain
- **Real-Time Pricing**: Powered by 1inch API with ETH/USDC base quotes
- **Smart Categorization**: Significant, Medium, and Dust token classification
- **Comprehensive Coverage**: Scans all token balances across supported networks

### 💼 **Wallet Integration**
- **WalletConnect v2**: Connect with any WalletConnect-compatible wallet
- **MetaMask Support**: Direct browser extension integration
- **Session Persistence**: Automatic reconnection across page reloads
- **ENS Resolution**: Display ENS names instead of raw addresses

### 🎨 **Professional Terminal UX**
- **Tab Autocomplete**: Smart completion for commands and chain names
- **Command History**: Navigate previous commands with arrow keys
- **Responsive Design**: Works beautifully on desktop and mobile
- **ANSI Art Support**: Rich terminal graphics and colors
- **Optimized Input**: Smooth typing experience without cursor glitches

## 🚀 Quick Start

### Web Terminal (Recommended)
1. **Visit**: [uniter.sh](https://uniter.sh) (or run locally)
2. **Connect**: Type `connect` to link your wallet
3. **Scan**: Use `scan base` or `multichain` to analyze your portfolio
4. **Explore**: Try `help` to see all available commands

### CLI Terminal
```bash
# Clone the repository
git clone https://github.com/your-org/uniter.sh.git
cd uniter.sh

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# Run CLI
npm run cli
```

## 🔧 Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- 1inch API key (for token pricing)
- WalletConnect Project ID (for wallet connections)

### Environment Variables
```bash
# Required for CLI
VITE_ONEINCH_API_KEY=your_1inch_api_key
VITE_REOWN_PROJECT_ID=your_walletconnect_project_id

# Optional
DEBUG=true  # Enable verbose logging
```

### Local Development
```bash
# Install dependencies
npm install

# Start web development server
npm run dev

# Run CLI version
npm run cli

# Build for production
npm run build

# Run tests
npm test
```

### Project Structure
```
uniter.sh/
├── shared/           # Cross-platform core logic
│   ├── api.ts       # Unified API layer
│   ├── chains.ts    # Chain configurations
│   ├── scanner-core.ts
│   ├── token-processor.ts
│   └── terminal/    # Terminal engine
├── cli/             # CLI-specific code
│   ├── cli.ts       # CLI entry point
│   ├── adapter.ts   # CLI environment adapter
│   └── wallet.ts    # CLI wallet management
├── app/             # Web app code
│   ├── index.html   # Web terminal UI
│   ├── main.ts      # Web app entry
│   ├── adapter.ts   # Web environment adapter
│   ├── wallet.ts    # Web wallet (Wagmi)
│   └── renderer.ts  # Web terminal renderer
└── dist-web/        # Built web assets
```

## 📋 Commands

### Core Commands
- `help` - Show all available commands
- `connect` - Connect your wallet via WalletConnect
- `disconnect` - Disconnect current wallet
- `status` - Show wallet connection status

### Scanning Commands
- `scan [chain]` - Scan tokens on specific chain (e.g., `scan base`)
- `multichain` - Scan tokens across all supported chains
- `chains` - List all supported chains

### Utility Commands
- `clear` - Clear terminal screen
- `exit` / `quit` / `q` - Exit the terminal

### Navigation
- **Tab** - Auto-complete commands and chain names
- **↑/↓ Arrow Keys** - Browse command history
- **Ctrl+C (twice)** - Force quit (CLI only)

## 🌍 Supported Chains

| Chain | Network ID | Chain ID |
|-------|------------|----------|
| Ethereum | `ethereum` | 1 |
| Base | `base` | 8453 |
| Arbitrum One | `arbitrum` | 42161 |
| Polygon | `polygon` | 137 |
| Avalanche | `avalanche` | 43114 |
| BNB Smart Chain | `bnb` | 56 |
| OP Mainnet | `optimism` | 10 |
| ZKsync Era | `zksync` | 324 |
| Linea Mainnet | `linea` | 59144 |
| Gnosis | `gnosis` | 100 |
| Sonic | `sonic` | 146 |
| Unichain | `unichain` | 1301 |

## 🔒 Security & Privacy

- **No Backend**: Fully client-side application
- **No Data Storage**: No user data stored on servers
- **Secure Connections**: All API calls use HTTPS
- **Local Session**: Wallet sessions stored locally only
- **Open Source**: Full transparency of all code

## 🛠 Technical Details

### Architecture
- **Unified Engine**: Single codebase for CLI and web
- **Environment Adapters**: Platform-specific implementations
- **Shared Logic**: Common scanning, pricing, and display code
- **Modular Design**: Clean separation of concerns

### APIs & Integrations
- **1inch API**: Token discovery and pricing
- **WalletConnect v2**: Wallet connection protocol
- **Wagmi**: React hooks for Ethereum (web)
- **Viem**: TypeScript interface for Ethereum
- **xterm.js**: Terminal emulator for web

### Performance
- **Async Scanning**: Non-blocking token discovery
- **Efficient Pricing**: Minimal API calls with caching
- **Smart Filtering**: Focus on significant token holdings
- **Responsive UI**: Optimized for smooth user experience

## 📊 Example Output

```bash
🦄 uniter.sh Web Terminal — Make tokens unitETH with 1inch!

          Type "help" to see available commands

──────────────────────────────────────────────────────────────

No wallet connected
Use "connect" to connect your wallet

unitl.eth@uniter.sh> multichain

🔍 Scanning tokens across all chains...
📊 Portfolio Summary: $1,234.56 across 15 tokens on 4 chains

💎 Significant Holdings ($50+):
  USDC    $456.78  (Base)
  ETH     $321.45  (Ethereum)
  WETH    $234.56  (Arbitrum)

💰 Medium Holdings ($5-$50):
  ARB     $23.45   (Arbitrum)
  OP      $12.34   (Optimism)

🪙 Total Tokens: 15
⛓️ Chains Scanned: 4
✅ Multichain scan complete!
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [uniter.sh](https://uniter.sh)
- **GitHub**: [github.com/your-org/uniter.sh](https://github.com/your-org/uniter.sh)
- **1inch**: [1inch.io](https://1inch.io)
- **WalletConnect**: [walletconnect.com](https://walletconnect.com)

---

**Made with ❤️ for the DeFi community**

*uniter.sh - Making tokens unitETH, one scan at a time!*
