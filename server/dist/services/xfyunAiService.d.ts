interface XfyunMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface XfyunChatRequest {
    model: string;
    messages: XfyunMessage[];
    max_tokens?: number;
    temperature?: number;
}
interface XfyunBatchRequest {
    custom_id: string;
    method: 'POST';
    url: '/v1/chat/completions';
    body: XfyunChatRequest;
}
interface XfyunFileResponse {
    id: string;
    object: string;
    bytes: number;
    created_at: number;
    filename: string;
    purpose: string;
}
interface XfyunBatchResponse {
    id: string;
    object: string;
    endpoint: string;
    input_file_id: string;
    status: string;
    output_file_id?: string;
    error_file_id?: string;
    created_at: number;
    request_counts?: {
        total: number;
        completed: number;
        failed: number;
    };
}
export declare class XfyunAiService {
    private apiPassword;
    private baseUrl;
    private axiosInstance;
    constructor();
    isAvailable(): boolean;
    chat(messages: XfyunMessage[], model?: string, retries?: number): Promise<string>;
    uploadFile(filePath: string, purpose?: string): Promise<XfyunFileResponse>;
    createBatch(inputFileId: string, endpoint?: string): Promise<XfyunBatchResponse>;
    getBatch(batchId: string): Promise<XfyunBatchResponse>;
    downloadFile(fileId: string): Promise<string>;
    createBatchRequestFile(requests: XfyunBatchRequest[]): string;
    private fixJsonFormat;
    generateQuiz(text: string, options?: any): Promise<any>;
    private extractQuizFromText;
    private buildQuizGenerationPrompt;
}
export declare const xfyunAiService: XfyunAiService;
export {};
//# sourceMappingURL=xfyunAiService.d.ts.map