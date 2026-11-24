import asyncio, os, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(
        command="uvx",
        args=["--python", "3.11", "--from", "mcp-for-blender", "mcp-for-blender", "--port", os.environ.get("BLENDER_PORT", "9877")],
        env={**os.environ, "UV_PYTHON_PREFERENCE": "only-managed", "DISABLE_TELEMETRY": "true"},
    )
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
            print("TOOLS:", sorted(t.name for t in tools.tools))
            res = await s.call_tool("get_addon_status", {})
            print("ADDON_STATUS:", str(res.content)[:400])
            res = await s.call_tool("get_scene_info", {})
            print("SCENE_INFO:", str(res.content)[:400])

asyncio.run(main())
