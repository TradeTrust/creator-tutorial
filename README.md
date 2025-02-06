# Creator Tutorial

## Overview

TradeTrust Creator Tutorial is a guide to help developers understand and implement TradeTrust's document creation process. This tutorial provides step-by-step instructions for creating, deploying, and managing verifiable documents using the TradeTrust framework.

## Prerequisites

- Node.js (v18 or higher)
- npm
- Basic understanding of blockchain technology and smart contracts

## Setting Up the Project

Follow these steps to set up the project locally:

1. Clone the repository:

```bash
git clone https://github.com/TradeTrust/creator-tutorial.git
cd creator-tutorial
```

1. Install dependencies:

Use npm to install the necessary dependencies:

```bash
npm install
```

1. Copy the environment file and configure your settings:

```bash
cp .env.sample .env
```

Update the `.env` file with your settings for `DOMAIN`, `WALLET_PRIVATE_KEY`, and `NET`.

1. Excute the pre scripts:

```bash
npm run generate:did-web
npm run deploy:token-registry
```

1. Run the development server:

```bash
npm run dev
```

## Related Projects

- [Token Registry](https://github.com/TradeTrust/token-registry)
- [TrustVC](https://github.com/TrustVC/trustvc)
- [TradeTrust Website](https://github.com/TradeTrust/tradetrust-website)