import { GraphData } from "../types/graph";

// This is a placeholder for the logic that will construct the graph for React Flow.

export interface GraphBuilder {
    buildGraph(): Promise<GraphData>;
}

export class DefaultGraphBuilder implements GraphBuilder {
    async buildGraph(): Promise<GraphData> {
        // TODO: Implement graph construction from analysis results in a later step.
        throw new Error("Not implemented: GraphBuilder is empty in Step 1.");
    }
}
