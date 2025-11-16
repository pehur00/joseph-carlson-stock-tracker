"""
Crew Configuration for Joseph Carlson Show Stock Tracker
Orchestrates agents to fetch, analyze, and format stock data.
"""

import os
from datetime import datetime
from crewai import Crew, Task, Process
from langchain_openai import ChatOpenAI
from agents.data_fetcher_agent import create_data_fetcher_agent
from agents.analyst_agent import create_analyst_agent
from agents.formatter_agent import create_formatter_agent
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# List of tickers to track (from Joseph Carlson Show)
TICKERS = [
    "DUOL", "CMG", "ADBE", "MELI", "CRWV",
    "CRM", "SPGI", "EFX", "NFLX", "ASML", "MA"
]


def create_stock_tracker_crew():
    """Creates and configures the stock tracker crew."""

    # Initialize LLM using OpenRouter
    # Get API key and model from environment
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001:free")

    if not api_key:
        raise ValueError(
            "OPENROUTER_API_KEY not found in environment variables. "
            "Please set it in your .env file or environment."
        )

    llm = ChatOpenAI(
        model=model,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        temperature=0.1,  # Low temperature for more deterministic outputs
        default_headers={
            "HTTP-Referer": "https://github.com/josephcarlson/stock-tracker",
            "X-Title": "Joseph Carlson Stock Tracker",
        }
    )

    # Create agents
    data_fetcher = create_data_fetcher_agent(llm)
    analyst = create_analyst_agent(llm)
    formatter = create_formatter_agent(llm)

    # Define tasks
    fetch_task = Task(
        description=f"""Fetch the latest stock prices and basic financial metrics
        for the following tickers: {', '.join(TICKERS)}.

        For each ticker, gather:
        - Current stock price (in USD)
        - Recent trading activity
        - Basic financial metrics (revenue, FCF, debt, cash if available)

        Return the data in a clear, structured format.""",
        agent=data_fetcher,
        expected_output="A structured report with current prices and financial metrics for all tickers"
    )

    analysis_task = Task(
        description="""Using the fetched stock data, perform a comprehensive
        financial analysis for each stock. For each ticker:

        1. Calculate DCF valuation ranges:
           - Conservative scenario (pessimistic assumptions)
           - Base case scenario (most likely assumptions)
           - Aggressive scenario (optimistic assumptions)

        2. Assign factor scores (1-5 scale) for:
           - fcfQuality: Free cash flow consistency and growth
           - roicStrength: Return on invested capital vs. cost of capital
           - revenueDurability: Recurring revenue and competitive moat
           - balanceSheetStrength: Debt levels and financial flexibility
           - insiderActivity: Recent insider buying/selling patterns
           - valueRank: Overall cheapness vs. intrinsic value
           - expectedReturn: Potential upside from current price

        Provide clear reasoning for each score and valuation range.""",
        agent=analyst,
        expected_output="Detailed financial analysis with DCF ranges and factor scores for all stocks",
        context=[fetch_task]
    )

    format_task = Task(
        description=f"""Format the analyzed stock data into a valid JSON array
        following this exact structure:

        [
          {{
            "category": "Growth" or "Dividend",
            "ticker": "TICKER",
            "name": "Company Name",
            "price": 0.00,
            "dcf": {{
              "conservative": "low-high",
              "base": "low-high",
              "aggressive": "low-high"
            }},
            "fcfQuality": 1-5,
            "roicStrength": 1-5,
            "revenueDurability": 1-5,
            "balanceSheetStrength": 1-5,
            "insiderActivity": 1-5,
            "valueRank": 1-5,
            "expectedReturn": 1-5,
            "lastUpdated": "{datetime.now().strftime('%Y-%m-%d')}"
          }}
        ]

        Requirements:
        - All factor scores must be integers between 1 and 5
        - DCF ranges must be strings in format "low-high" (e.g., "450-500")
        - Price must be a number, not string
        - Category must be either "Dividend" or "Growth"
        - Output ONLY valid JSON, no commentary or extra text
        - No trailing commas
        - lastUpdated should be today's date in ISO format

        Save the output to output/stocks.json""",
        agent=formatter,
        expected_output="Valid JSON file saved to output/stocks.json",
        context=[analysis_task],
        output_file="output/stocks.json"
    )

    # Create and return the crew
    crew = Crew(
        agents=[data_fetcher, analyst, formatter],
        tasks=[fetch_task, analysis_task, format_task],
        process=Process.sequential,  # Tasks run in order
        verbose=True,
    )

    return crew


if __name__ == "__main__":
    print("Starting Joseph Carlson Show Stock Tracker Crew...")
    print(f"Analyzing tickers: {', '.join(TICKERS)}")
    print("-" * 60)

    crew = create_stock_tracker_crew()
    result = crew.kickoff()

    print("-" * 60)
    print("Crew execution completed!")
    print(f"Result: {result}")
