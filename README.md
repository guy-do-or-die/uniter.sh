# 🦄 uniter.sh - Unified DeFi Terminal

**Unite all your onchain dust and scattered assets into ETH in one smart command**

A cross-platform DeFi portfolio scanner and token sweeper that works in both CLI and web environments. Scan multi-chain token holdings, get real-time USD valuations, and sweep dust tokens with 1inch integration.

## ✨ Features

- **Multi-Chain Scanning**: 12+ supported chains with real-time token discovery
- **Smart Token Sweeping**: Convert dust tokens to native tokens using 1inch
- **Cross-Platform**: Unified CLI and web terminal with identical functionality
- **Professional UX**: Tab completion, command history, ANSI graphics
- **WalletConnect Integration**: Connect any compatible wallet
- **Session Persistence**: Automatic reconnection across sessions

## 🚀 Quick Start

### Web Terminal (Recommended)
1. **Visit**: [uniter.sh](https://uniter.sh) or run locally with `bun run dev:web`
2. **Connect**: Type `connect` to link your wallet
3. **Scan**: Use `scan base` or `multichain` to analyze your portfolio
4. **Sweep**: Use `sweep` to convert dust tokens to native tokens

### CLI Terminal
```bash
# Clone and install
git clone https://github.com/your-org/uniter.sh.git
cd uniter.sh
bun install

# Set up environment
cp .env.example .env
# Add ONEINCH_API_KEY and VITE_REOWN_PROJECT_ID

# Run CLI
bun run dev:cli
```

## 🔧 Development

### Prerequisites
- Bun (recommended) or Node.js 18+
- 1inch API key
- WalletConnect Project ID

### Environment Variables
```bash
ONEINCH_API_KEY=your_1inch_api_key
VITE_REOWN_PROJECT_ID=your_walletconnect_project_id
```

### Development Commands
```bash
bun install              # Install dependencies
bun run dev:web          # Start web dev server
bun run dev:cli          # Run CLI version
bun run build            # Build for production
bun run test             # Run tests
```

### Project Structure
```
uniter.sh/
├── core/            # Cross-platform core logic
│   ├── api.ts       # 1inch API integration
│   ├── chains.ts    # Chain configurations
│   ├── sweep.ts     # Token sweeping logic
│   ├── portfolio-*.ts # Portfolio scanning & display
│   └── terminal/    # Terminal engine
├── cli/             # CLI-specific code
├── app/             # Web app code
├── api/             # Vercel API routes (proxy)
└── dist-web/        # Built web assets
```

## 📋 Commands

### Core Commands
- `help` - Show all available commands
- `about` - About uniter.sh
- `connect` - Connect wallet via WalletConnect
- `disconnect` - Disconnect current wallet
- `status` - Show wallet connection status

### Portfolio Commands
- `scan [chain]` - Scan tokens on specific chain (e.g., `scan base`)
- `multichain` - Scan tokens across all supported chains
- `sweep` - Swap all dust tokens to native tokens
- `unite [chain]` - Unite collected ETH to chain of choice

### Utility Commands
- `chains` - List all supported chains
- `key` - Set API key
- `clear` - Clear terminal screen
- `exit` / `quit` / `q` - Exit terminal

### Navigation
- **Tab** - Auto-complete commands and chain names
- **↑/↓ Arrow Keys** - Browse command history

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

## 🛠 Technical Stack

- **1inch API**: Token discovery, pricing, and swapping
- **WalletConnect v2**: Wallet connection protocol
- **Viem**: TypeScript Ethereum interface
- **xterm.js**: Web terminal emulator
- **TypeScript**: Full type safety
- **Vercel**: Deployment and API proxy

## 📊 Example Usage

```bash
🦄 uniter.sh Web Terminal

unitl.eth@uniter.sh> connect
✅ Wallet connected: 0x1234...5678

unitl.eth@uniter.sh> multichain
🔍 Scanning tokens across all chains...
📊 Portfolio: $1,234.56 across 15 tokens on 4 chains


💎 Significant Holdings ($50+):
  USDC    $456.78  (Base)
  ETH     $321.45  (Ethereum)

💰 Medium Holdings ($5-$50):
  ARB     $23.45   (Arbitrum)

🪙 Dust Holdings (<$5): 8 tokens
✅ Scan complete!

unitl.eth@uniter.sh> sweep
🧹 Sweeping 8 dust tokens...
✅ Swapped 6 tokens successfully
💰 Received 0.0234 ETH
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the DeFi community**

*Unite all your onchain dust and scattered assets into a single token in one smart command*
