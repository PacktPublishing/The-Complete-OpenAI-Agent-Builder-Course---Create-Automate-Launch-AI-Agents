import { z } from "zod";
import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";

const SummarizerSchema = z.object({ title: z.string(), topic: z.string(), raw_content: z.string(), summary: z.string() });
const FormatAgentSchema = z.object({ topic: z.string(), title: z.string(), summaryMd: z.string() });
const summarizer = new Agent({
  name: "Summarizer",
  instructions: `Generate an article on the given topic, then summarize the generated article in an easy-to-understand manner, using simple language that is accessible to a general audience.

- Begin by analyzing the topic and identifying its key points or core ideas. Consider what information is essential for someone unfamiliar with the subject.
- Organize your thoughts in a logical order to ensure clarity.
- Do not include the summary before you have reasoned through the key points; reasoning should come first, and the final summary should be presented last.
- Your summary should be brief—generally between 2 and 4 sentences—avoiding unnecessary details or jargon unless briefly defined.
- If the input topic is particularly complex, include a placeholder for technical terms or concepts ([EXPLAIN TERM]), and provide a more accessible explanation if necessary.

**Example:**

**Input Topic:** Quantum Computing

**Reasoning:**
- Identify that quantum computing uses quantum bits (qubits) instead of regular bits.
- Note that it can solve certain types of problems much faster than classical computers.
- Mention current limitations: technology is experimental and not widely available.

**Summary:**  
Quantum computing is a new type of computing that uses quantum bits (qubits), which can represent multiple states at once. This technology has the potential to solve specific problems much more efficiently than traditional computers, though it is still in the early stages of development and not commonly used.

---

**REMINDER:**  
Summarize the topic clearly for a general audience. Organize your thoughts first (as a reasoning list) before giving the final summary.

**Output Format:**  
 a valid JSON with the following structure:
  \"title\" : <title>
  \"topic\": <topic>
 \"raw_content\": <the actual article generated>
\"summary\": <summary of the article>
`,
  model: "gpt-5",
  outputType: SummarizerSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const formatAgent = new Agent({
  name: "Format Agent",
  instructions: `Format the provided input into clear, well-structured markdown suitable for display in a user interface (UI). 

Preserve all original content; do not omit or summarize any information. Organize the content with appropriate markdown elements (such as headers, bullet points, numbered lists, bold, italics, or tables), ensuring a clean visual structure and enhanced readability. When encountering code snippets, enclose them in proper markdown code blocks, respecting the syntax if specified. For sections where structure is unclear, use your judgment to apply suitable markdown formatting that best clarifies or organizes the information.

Always review the result to ensure that:
- The content displays cleanly without markdown errors.
- Headings, lists, and sections are clearly and consistently formatted.
- Any technical or code content is properly rendered for user interaction.
- The output contains only the formatted markdown—no narrative or extra commentary.
`,
  model: "gpt-5",
  outputType: FormatAgentSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const approvalRequest = (message: string) => {

  // TODO: Implement
  return true;
}

type WorkflowInput = { input_as_text: string };


// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("Article Writer & Summarizer", async () => {
    const state = {

    };
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: workflow.input_as_text
          }
        ]
      }
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_68ee9e7e567c81908fb36fa0c31f7a3b0662811a3dd1fa10"
      }
    });
    const summarizerResultTemp = await runner.run(
      summarizer,
      [
        ...conversationHistory
      ]
    );
    conversationHistory.push(...summarizerResultTemp.newItems.map((item) => item.rawItem));

    if (!summarizerResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    const summarizerResult = {
      output_text: JSON.stringify(summarizerResultTemp.finalOutput),
      output_parsed: summarizerResultTemp.finalOutput
    };
    const transformResult = {result: "📰 **" + summarizerResult.output_parsed.title + "**\n" + "Topic: " + summarizerResult.output_parsed.topic + "\n\n" + summarizerResult.output_parsed.summary + "\n\n" + summarizerResult.output_parsed.raw_content + "\n\n---\nGenerated by your Summarizer Agent"};
    const approvalMessage = `Would you like to proceed with this:
   ${transformResult.result}`;

    if (approvalRequest(approvalMessage)) {
        const formatAgentResultTemp = await runner.run(
          formatAgent,
          [
            ...conversationHistory
          ]
        );
        conversationHistory.push(...formatAgentResultTemp.newItems.map((item) => item.rawItem));

        if (!formatAgentResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }

        const formatAgentResult = {
          output_text: JSON.stringify(formatAgentResultTemp.finalOutput),
          output_parsed: formatAgentResultTemp.finalOutput
        };
    } else {
        return transformResult;
    }
  });
}
