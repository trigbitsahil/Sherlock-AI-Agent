import { mcpServerInstance } from "./mcp/server/index";

async function test() {
  const tabsResult = await mcpServerInstance.executeTool("getTabs", { spreadsheetName: "Clients_Sheet" });
  console.log(JSON.stringify(tabsResult, null, 2));
}

test();
