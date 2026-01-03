# Contributing to DappScore

Thank you for your interest in contributing to DappScore! This guide will help you get started.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community
- Show empathy towards other contributors

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/wallet info
   - Screenshots if applicable

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Explain the problem you're solving
4. Describe your proposed solution
5. Consider alternatives

### Code Contributions

#### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/dappscore/platform.git
cd platform

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

#### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring

Example: `feature/add-vote-comments`

#### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

Example:
```
feat(voting): add comment support for votes

Users can now add comments when voting on projects.
Comments are displayed on the project detail page.

Closes #123
```

#### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Run linting and tests
6. Submit a pull request

#### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Responsive design verified
- [ ] Wallet integration tested

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- voting.test.ts
```

### Linting

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Project Structure

```
platform/
├── dappscore/           # Next.js frontend
│   ├── src/
│   │   ├── app/         # App router pages
│   │   ├── components/  # React components
│   │   ├── config/      # Configuration
│   │   ├── hooks/       # Custom hooks
│   │   └── providers/   # Context providers
│   └── public/          # Static assets
├── contracts/           # Solidity smart contracts
├── docs/                # Documentation
└── scripts/             # Build/deploy scripts
```

## Smart Contract Development

### Requirements

- Solidity 0.8.20+
- Foundry or Hardhat
- Base Sepolia testnet ETH

### Testing Contracts

```bash
cd contracts
forge test
```

### Deploying to Testnet

```bash
forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast
```

## Documentation

Help improve our docs:

1. Fork the repository
2. Edit files in `/docs`
3. Submit a pull request

Documentation uses GitBook format (Markdown).

## Community

- [Discord](https://discord.gg/dappscore)
- [Twitter](https://twitter.com/dappscore)
- [GitHub Discussions](https://github.com/dappscore/platform/discussions)

## Recognition

Contributors are recognized in:

- README contributors section
- Monthly community highlights
- Special $SCORE rewards for significant contributions

## Questions?

Feel free to ask in Discord or open a GitHub Discussion. We're here to help!
