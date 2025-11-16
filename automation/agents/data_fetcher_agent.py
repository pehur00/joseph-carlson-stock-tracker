"""
Data Fetcher Agent
Fetches current stock prices and basic financial data using BrightData MCP.
"""

from crewai import Agent
from tools.brightdata_tools import get_brightdata_tools


def create_data_fetcher_agent(llm):
    """Creates a data fetcher agent that gathers stock prices and data."""

    return Agent(
        role='Stock Data Fetcher',
        goal='Fetch the latest stock prices and basic financial metrics for Joseph Carlson Show stocks',
        backstory="""You are an expert data gatherer who specializes in collecting
        real-time stock market data. You use reliable sources and web scraping tools
        to gather accurate, up-to-date information about stock prices, trading volumes,
        and basic financial metrics. You are thorough and always verify your data sources.""",
        tools=get_brightdata_tools(),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
