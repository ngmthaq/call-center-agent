# CALL CENTER AGENT

1. Install Node.js

LiveKit Agents for Node.js requires Node.js >= 20. [Node.js](https://nodejs.org/en/download)

2. Install Livekit CLI

MacOS: `brew install livekit-cli`
Linux: `curl -sSL https://get.livekit.io/cli | bash`
Windows: `winget install LiveKit.LiveKitCLI`

3. Link Livekit Cloud to Livekit CLI

`lk cloud auth`

4. Install dependencies

`pnpm install`

5. Download model files

`pnpm download-files`

6. Testing

Use the [Agent Console](https://docs.livekit.io/agents/start/console/) to interact with and debug your agent in real-time. Note that you'll need to set the Agent name
