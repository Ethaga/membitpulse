LangChain Membit Tool Example

This folder contains a minimal example showing how to wrap the Membit API as LangChain Tools and initialize a simple agent.

Files:
- membit_tool.py  -> helper functions that call Membit endpoints and return concise text summaries
- agent_example.py -> LangChain agent example using ChatOpenAI and the Membit tools
- requirements.txt -> Python dependencies

Setup:
1. Create a virtualenv and install requirements:
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

2. Set environment variables:
   export MEMBIT_API_KEY="<your membit key>"
   export OPENAI_API_KEY="<your openai key>"   # or other provider supported by LangChain

3. Run the example:
   python agent_example.py

Notes:
- The example uses ChatOpenAI from LangChain; change to other LLM classes if you prefer Anthropic/Claude.
- The tool functions in membit_tool.py summarize the returned objects; adapt parsing to the actual Membit response shape if different.
- This example is for local experimentation. For production, tighten error handling, add rate-limiting, and ensure API keys are stored securely.
