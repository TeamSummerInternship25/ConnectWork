"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xfyunAiService = exports.XfyunAiService = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
class XfyunAiService {
    constructor() {
        this.apiPassword = process.env.XFYUN_API_PASSWORD || '';
        this.baseUrl = process.env.XFYUN_BASE_URL || 'https://spark-api-open.xf-yun.com';
        if (!this.apiPassword) {
            console.warn('⚠️ XFYUN_API_PASSWORD not found, AI service will be disabled');
        }
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiPassword}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });
    }
    isAvailable() {
        if (!this.apiPassword) {
            return false;
        }
        const parts = this.apiPassword.split(':');
        if (parts.length !== 2) {
            console.warn('⚠️ XFYUN_API_PASSWORD format should be "AppId:APISecret"');
            return false;
        }
        return true;
    }
    async chat(messages, model = 'lite', retries = 2) {
        if (!this.isAvailable()) {
            throw new Error('Xfyun AI service is not available');
        }
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                console.log(`🤖 Xfyun AI request attempt ${attempt + 1}/${retries + 1}`);
                console.log(`📝 Request details:`, {
                    url: `${this.baseUrl}/v1/chat/completions`,
                    model,
                    messagesCount: messages.length,
                    hasAuth: !!this.apiPassword
                });
                const response = await this.axiosInstance.post('/v1/chat/completions', {
                    model,
                    messages,
                    max_tokens: 2000,
                    temperature: 0.7
                });
                const result = response.data;
                const content = result.choices[0]?.message?.content || '';
                if (!content.trim()) {
                    throw new Error('Empty response from AI service');
                }
                console.log('✅ Xfyun AI request successful');
                return content;
            }
            catch (error) {
                const isLastAttempt = attempt === retries;
                const errorMessage = error.response?.data?.error || error.message;
                const statusCode = error.response?.status;
                const responseData = error.response?.data;
                console.error(`❌ Xfyun chat error (attempt ${attempt + 1}):`, {
                    message: errorMessage,
                    statusCode,
                    responseData,
                    timeout: error.code === 'ECONNABORTED'
                });
                if (isLastAttempt) {
                    throw new Error(`Xfyun AI request failed after ${retries + 1} attempts: ${errorMessage}`);
                }
                const waitTime = (attempt + 1) * 2000;
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        throw new Error('Unexpected error in chat method');
    }
    async uploadFile(filePath, purpose = 'batch') {
        if (!this.isAvailable()) {
            throw new Error('Xfyun AI service is not available');
        }
        try {
            const formData = new form_data_1.default();
            formData.append('purpose', purpose);
            formData.append('file', fs_1.default.createReadStream(filePath));
            const response = await axios_1.default.post(`${this.baseUrl}/v1/files`, formData, {
                headers: {
                    'Authorization': `Bearer ${this.apiPassword}`,
                    ...formData.getHeaders()
                },
                timeout: 60000
            });
            return response.data;
        }
        catch (error) {
            console.error('Xfyun file upload error:', error.response?.data || error.message);
            throw new Error(`File upload failed: ${error.response?.data?.error || error.message}`);
        }
    }
    async createBatch(inputFileId, endpoint = '/v1/chat/completions') {
        if (!this.isAvailable()) {
            throw new Error('Xfyun AI service is not available');
        }
        try {
            const response = await this.axiosInstance.post('/v1/batches', {
                input_file_id: inputFileId,
                endpoint,
                completion_window: '24h',
                metadata: {
                    purpose: 'quiz_generation',
                    service: 'popquiz'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Xfyun batch creation error:', error.response?.data || error.message);
            throw new Error(`Batch creation failed: ${error.response?.data?.error || error.message}`);
        }
    }
    async getBatch(batchId) {
        if (!this.isAvailable()) {
            throw new Error('Xfyun AI service is not available');
        }
        try {
            const response = await this.axiosInstance.get(`/v1/batches/${batchId}`);
            return response.data;
        }
        catch (error) {
            console.error('Xfyun batch query error:', error.response?.data || error.message);
            throw new Error(`Batch query failed: ${error.response?.data?.error || error.message}`);
        }
    }
    async downloadFile(fileId) {
        if (!this.isAvailable()) {
            throw new Error('Xfyun AI service is not available');
        }
        try {
            const response = await this.axiosInstance.get(`/v1/files/${fileId}/content`);
            return response.data;
        }
        catch (error) {
            console.error('Xfyun file download error:', error.response?.data || error.message);
            throw new Error(`File download failed: ${error.response?.data?.error || error.message}`);
        }
    }
    createBatchRequestFile(requests) {
        const lines = requests.map(req => JSON.stringify(req));
        return lines.join('\n');
    }
    fixJsonFormat(jsonString) {
        try {
            JSON.parse(jsonString);
            console.log('✅ JSON格式正确，无需修复');
            return jsonString;
        }
        catch (originalError) {
            console.log('🔧 JSON需要修复，开始处理...');
        }
        try {
            let fixed = jsonString
                .replace(/^\uFEFF/, '')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
            JSON.parse(fixed);
            console.log('✅ 常规JSON修复成功');
            return fixed;
        }
        catch (error) {
            console.warn('⚠️ 常规JSON修复失败，尝试激进方法:', error);
        }
        try {
            let aggressive = jsonString
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                .replace(/\\/g, '\\\\')
                .replace(/\\\\\\\\/g, '\\\\')
                .replace(/\\\\"/g, '\\"')
                .replace(/\\\\n/g, '\\n')
                .replace(/\\\\r/g, '\\r')
                .replace(/\\\\t/g, '\\t')
                .replace(/([^\\])'/g, '$1"')
                .replace(/^'/g, '"');
            JSON.parse(aggressive);
            console.log('✅ 激进JSON修复成功');
            return aggressive;
        }
        catch (aggressiveError) {
            console.warn('⚠️ 激进修复失败，尝试最后的方法:', aggressiveError);
        }
        try {
            let lastAttempt = jsonString
                .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '')
                .replace(/\\/g, '')
                .replace(/"/g, '\\"')
                .replace(/\\"/g, '"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
            JSON.parse(lastAttempt);
            console.log('✅ 最后尝试JSON修复成功');
            return lastAttempt;
        }
        catch (finalError) {
            console.error('❌ 所有JSON修复方法都失败了，返回原始字符串');
            console.error('原始内容预览:', jsonString.substring(0, 200));
            return jsonString;
        }
    }
    async generateQuiz(text, options = {}) {
        const prompt = this.buildQuizGenerationPrompt(text, options);
        const messages = [
            {
                role: 'system',
                content: 'You are an expert quiz generator. Generate high-quality multiple choice questions based on the provided content.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];
        const response = await this.chat(messages, '4.0Ultra');
        try {
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }
            else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            const jsonStart = cleanResponse.indexOf('{');
            const jsonEnd = cleanResponse.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
            }
            cleanResponse = this.fixJsonFormat(cleanResponse);
            const parsedResponse = JSON.parse(cleanResponse);
            if (!parsedResponse.title || !parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
                console.error('Invalid quiz structure:', parsedResponse);
                throw new Error('Quiz response missing required fields');
            }
            return parsedResponse;
        }
        catch (error) {
            console.error('❌ Failed to parse quiz response from Xfyun AI');
            console.error('📄 Original response length:', response.length);
            console.error('📄 Original response preview:', response.substring(0, 500) + '...');
            if (error instanceof SyntaxError && error.message.includes('position')) {
                const match = error.message.match(/position (\d+)/);
                if (match) {
                    const position = parseInt(match[1]);
                    const start = Math.max(0, position - 50);
                    const end = Math.min(response.length, position + 50);
                    console.error('🔍 Error context around position', position, ':', response.substring(start, end));
                }
            }
            console.error('🚨 Parse error details:', error);
            console.log('🔄 尝试使用正则表达式提取Quiz内容...');
            const extractedQuiz = this.extractQuizFromText(response);
            if (extractedQuiz) {
                console.log('✅ 成功从文本中提取Quiz内容');
                return extractedQuiz;
            }
            throw new Error(`Invalid quiz response format: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    extractQuizFromText(text) {
        try {
            console.log('🔍 尝试从文本中提取Quiz结构...');
            const titleMatch = text.match(/["']?title["']?\s*:\s*["']([^"']+)["']/i) ||
                text.match(/标题[：:]\s*["']?([^"'\n]+)["']?/i);
            const title = titleMatch ? titleMatch[1].trim() : '自动生成的测验';
            const questions = [];
            const questionPatterns = [
                /问题\s*\d*[：:]\s*([^?\n]+\?)/gi,
                /["']?question["']?\s*:\s*["']([^"']+)["']/gi,
                /\d+\.\s*([^?\n]+\?)/gi
            ];
            let questionMatches = [];
            for (const pattern of questionPatterns) {
                const matches = Array.from(text.matchAll(pattern));
                if (matches.length > 0) {
                    questionMatches = matches;
                    break;
                }
            }
            for (let i = 0; i < Math.min(questionMatches.length, 5); i++) {
                const questionText = questionMatches[i][1].trim();
                const questionIndex = text.indexOf(questionMatches[i][0]);
                const nextQuestionIndex = i + 1 < questionMatches.length ?
                    text.indexOf(questionMatches[i + 1][0]) : text.length;
                const questionSection = text.substring(questionIndex, nextQuestionIndex);
                const optionMatches = questionSection.match(/[A-D][）)]\s*([^\n]+)/g) ||
                    questionSection.match(/["']?options?["']?\s*:\s*\[([^\]]+)\]/i);
                let options = ['选项A', '选项B', '选项C', '选项D'];
                if (optionMatches && optionMatches.length >= 4) {
                    options = optionMatches.slice(0, 4).map(opt => opt.replace(/^[A-D][）)]?\s*/, '').trim());
                }
                const answerMatch = questionSection.match(/["']?correctAnswer["']?\s*:\s*["']?([A-D])["']?/i) ||
                    questionSection.match(/正确答案[：:]\s*([A-D])/i) ||
                    questionSection.match(/答案[：:]\s*([A-D])/i);
                const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : 'A';
                questions.push({
                    question: questionText,
                    options,
                    correctAnswer
                });
            }
            if (questions.length > 0) {
                return {
                    title,
                    questions
                };
            }
            return null;
        }
        catch (error) {
            console.error('❌ 正则表达式提取失败:', error);
            return null;
        }
    }
    buildQuizGenerationPrompt(text, options = {}) {
        const { questionCount = 5, difficulty = 'medium', timeLimit = 10 } = options;
        const isChinese = /[\u4e00-\u9fff]/.test(text);
        if (isChinese) {
            return `
根据以下内容，生成${questionCount}道选择题。

内容：
${text}

要求：
1. 每道题必须有4个选项（A、B、C、D）
2. 只有一个选项是正确的
3. 题目难度为${difficulty === 'easy' ? '简单' : difficulty === 'hard' ? '困难' : '中等'}
4. 每道题应该在${timeLimit}秒内可以回答
5. 题目应该测试理解能力，而不仅仅是记忆
6. 避免过于明显或过于晦涩的题目
7. 所有内容必须使用中文

请严格按照以下JSON格式返回结果，不要添加任何其他文字：

{
  "title": "基于内容的测验",
  "questions": [
    {
      "question": "题目内容",
      "optionA": "选项A",
      "optionB": "选项B",
      "optionC": "选项C",
      "optionD": "选项D",
      "correctAnswer": "A",
      "explanation": "正确答案的简要解释"
    }
  ]
}

重要：
- 必须返回有效的JSON格式
- correctAnswer必须是"A"、"B"、"C"或"D"中的一个
- 不要在JSON前后添加任何解释文字
- 确保所有字符串都用双引号包围`;
        }
        else {
            return `
Based on the following content, generate ${questionCount} multiple choice questions.

Content:
${text}

Requirements:
1. Each question should have exactly 4 options (A, B, C, D)
2. Only one option should be correct
3. Questions should be ${difficulty} difficulty level
4. Each question should be answerable within ${timeLimit} seconds
5. Questions should test understanding, not just memorization
6. Avoid questions that are too obvious or too obscure

Return the result in this exact JSON format only, no additional text:

{
  "title": "Quiz based on provided content",
  "questions": [
    {
      "question": "Question text here",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correctAnswer": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Important:
- Must return valid JSON format
- correctAnswer must be exactly "A", "B", "C", or "D"
- Do not add any explanatory text before or after the JSON
- Ensure all strings are properly quoted`;
        }
    }
}
exports.XfyunAiService = XfyunAiService;
exports.xfyunAiService = new XfyunAiService();
//# sourceMappingURL=xfyunAiService.js.map