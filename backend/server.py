"""
Proxy server that wraps the Express.js API.
This is needed because supervisor expects a Python uvicorn server.
"""
import subprocess
import os
import sys

# Start the Node.js server
if __name__ == "__main__":
    os.chdir("/app")
    subprocess.run(["node", "api/server.js"], check=True)
