# Collector Split Tool

A tool for calculating and managing NFT collector royalty splits based on their collection history.

## Features

- Fetch collector data from TzKT API
- Calculate weighted splits based on collector scores
- Export split configuration in OBJKT-compatible format
- Validate split percentages and collector thresholds
- Real-time split calculations and updates

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/collector-split-tool.git
cd collector-split-tool
```

2. Create and activate a virtual environment (optional but recommended):
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
npm install
cd frontend && npm install
```

4. Create a `.env` file in the root directory with the following content:
```
REACT_APP_API_URL="http://localhost:8000"
REACT_APP_TZKT_API_URL="https://api.tzkt.io"
```

5. Start the development server:
```bash
npm start
```

6. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Usage

1. Enter a creator's Tezos address to fetch their collector data
2. View the ranked list of collectors based on their collection history
3. Configure split percentages and thresholds
4. Export the final split configuration in OBJKT-compatible format

## Environment Variables

- `REACT_APP_API_URL`: URL for the backend API (default: http://localhost:8000)
- `REACT_APP_TZKT_API_URL`: URL for the TzKT API (default: https://api.tzkt.io)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
