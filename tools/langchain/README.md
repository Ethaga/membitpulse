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

2. (Preferred) Use your server proxy endpoints so the LangChain tool does not need MEMBIT_API_KEY locally.
   - By default the tool calls the proxy at:
     https://b560de43035a4d848c2a15b158158d00-dbf084e4596c48838d40d27a8.fly.dev
   - To override, set MEMBIT_PROXY_BASE to your server URL, e.g.:
     export MEMBIT_PROXY_BASE="http://localhost:8080"

3. Set LLM provider env (e.g. OpenAI):
   export OPENAI_API_KEY="<your openai key>"

4. Run the example:
   python agent_example.py

Notes:
- The example uses ChatOpenAI from LangChain; change to other LLM classes if you prefer Anthropic/Claude.
- The tool functions in membit_tool.py summarize the returned objects; adapt parsing to the actual Membit response shape if different.
- This example is for local experimentation. For production, tighten error handling, add rate-limiting, and ensure API keys are stored securely.
