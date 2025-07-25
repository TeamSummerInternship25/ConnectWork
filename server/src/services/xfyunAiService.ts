import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

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

interface XfyunChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class XfyunAiService {
  private apiPassword: string;
  private baseUrl: string;
  private axiosInstance;

  constructor() {
    this.apiPassword = process.env.XFYUN_API_PASSWORD || '';
    this.baseUrl = process.env.XFYUN_BASE_URL || 'https://spark-api-open.xf-yun.com';

    if (!this.apiPassword) {
      console.warn('⚠️ XFYUN_API_PASSWORD not found, AI service will be disabled');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiPassword}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 增加到2分钟
    });
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    // 检查API密码格式是否正确（应该包含AppId和APISecret）
    if (!this.apiPassword) {
      return false;
    }

    // 讯飞API密码格式应该是 "AppId:APISecret"
    const parts = this.apiPassword.split(':');
    if (parts.length !== 2) {
      console.warn('⚠️ XFYUN_API_PASSWORD format should be "AppId:APISecret"');
      return false;
    }

    return true;
  }

  /**
   * 单次聊天请求 (用于实时生成)
   */
  async chat(messages: XfyunMessage[], model: string = 'lite', retries: number = 2): Promise<string> {
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

        const result = response.data as XfyunChatResponse;
        const content = result.choices[0]?.message?.content || '';

        if (!content.trim()) {
          throw new Error('Empty response from AI service');
        }

        console.log('✅ Xfyun AI request successful');
        return content;
      } catch (error: any) {
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

        // 等待一段时间后重试
        const waitTime = (attempt + 1) * 2000; // 2秒, 4秒, 6秒...
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Unexpected error in chat method');
  }

  /**
   * 批量处理 - 上传文件
   */
  async uploadFile(filePath: string, purpose: string = 'batch'): Promise<XfyunFileResponse> {
    if (!this.isAvailable()) {
      throw new Error('Xfyun AI service is not available');
    }

    try {
      const formData = new FormData();
      formData.append('purpose', purpose);
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${this.baseUrl}/v1/files`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiPassword}`,
          ...formData.getHeaders()
        },
        timeout: 60000
      });

      return response.data as XfyunFileResponse;
    } catch (error: any) {
      console.error('Xfyun file upload error:', error.response?.data || error.message);
      throw new Error(`File upload failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * 批量处理 - 创建批处理任务
   */
  async createBatch(inputFileId: string, endpoint: string = '/v1/chat/completions'): Promise<XfyunBatchResponse> {
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

      return response.data as XfyunBatchResponse;
    } catch (error: any) {
      console.error('Xfyun batch creation error:', error.response?.data || error.message);
      throw new Error(`Batch creation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * 批量处理 - 查询批处理状态
   */
  async getBatch(batchId: string): Promise<XfyunBatchResponse> {
    if (!this.isAvailable()) {
      throw new Error('Xfyun AI service is not available');
    }

    try {
      const response = await this.axiosInstance.get(`/v1/batches/${batchId}`);
      return response.data as XfyunBatchResponse;
    } catch (error: any) {
      console.error('Xfyun batch query error:', error.response?.data || error.message);
      throw new Error(`Batch query failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * 批量处理 - 下载结果文件
   */
  async downloadFile(fileId: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Xfyun AI service is not available');
    }

    try {
      const response = await this.axiosInstance.get(`/v1/files/${fileId}/content`);
      return response.data;
    } catch (error: any) {
      console.error('Xfyun file download error:', error.response?.data || error.message);
      throw new Error(`File download failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * 创建批处理请求文件
   */
  createBatchRequestFile(requests: XfyunBatchRequest[]): string {
    const lines = requests.map(req => JSON.stringify(req));
    return lines.join('\n');
  }

  /**
   * 修复JSON格式问题
   */
  private fixJsonFormat(jsonString: string): string {
    // 首先尝试直接解析，如果成功就不需要修复
    try {
      JSON.parse(jsonString);
      console.log('✅ JSON格式正确，无需修复');
      return jsonString;
    } catch (originalError) {
      console.log('🔧 JSON需要修复，开始处理...');
    }

    // 第一步：常规修复
    try {
      let fixed = jsonString
        // 移除BOM和其他不可见字符
        .replace(/^\uFEFF/, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // 修复字符串中的换行符
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        // 修复无效的反斜杠转义
        .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

      JSON.parse(fixed);
      console.log('✅ 常规JSON修复成功');
      return fixed;
    } catch (error) {
      console.warn('⚠️ 常规JSON修复失败，尝试激进方法:', error);
    }

    // 第二步：激进修复
    try {
      let aggressive = jsonString
        // 移除所有控制字符和不可见字符
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        // 重置所有反斜杠
        .replace(/\\/g, '\\\\')
        // 修复双重转义
        .replace(/\\\\\\\\/g, '\\\\')
        .replace(/\\\\"/g, '\\"')
        .replace(/\\\\n/g, '\\n')
        .replace(/\\\\r/g, '\\r')
        .replace(/\\\\t/g, '\\t')
        // 修复可能的引号问题
        .replace(/([^\\])'/g, '$1"')
        .replace(/^'/g, '"');

      JSON.parse(aggressive);
      console.log('✅ 激进JSON修复成功');
      return aggressive;
    } catch (aggressiveError) {
      console.warn('⚠️ 激进修复失败，尝试最后的方法:', aggressiveError);
    }

    // 第三步：最后的尝试 - 重新构建JSON
    try {
      // 尝试提取可能的JSON内容并重新构建
      let lastAttempt = jsonString
        .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '') // 只保留可打印字符和中文
        .replace(/\\/g, '') // 移除所有反斜杠
        .replace(/"/g, '\\"') // 重新转义引号
        .replace(/\\"/g, '"') // 恢复JSON结构引号
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      JSON.parse(lastAttempt);
      console.log('✅ 最后尝试JSON修复成功');
      return lastAttempt;
    } catch (finalError) {
      console.error('❌ 所有JSON修复方法都失败了，返回原始字符串');
      console.error('原始内容预览:', jsonString.substring(0, 200));
      return jsonString;
    }
  }

  /**
   * 生成测验题目 (单次请求)
   */
  async generateQuiz(text: string, options: any = {}): Promise<any> {
    const prompt = this.buildQuizGenerationPrompt(text, options);

    const messages: XfyunMessage[] = [
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
      // 清理响应内容，移除markdown代码块标记
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 尝试找到JSON对象的开始和结束
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
      }

      // 修复常见的JSON格式问题
      cleanResponse = this.fixJsonFormat(cleanResponse);

      const parsedResponse = JSON.parse(cleanResponse);

      // 验证响应格式
      if (!parsedResponse.title || !parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
        console.error('Invalid quiz structure:', parsedResponse);
        throw new Error('Quiz response missing required fields');
      }

      return parsedResponse;
    } catch (error) {
      console.error('❌ Failed to parse quiz response from Xfyun AI');
      console.error('📄 Original response length:', response.length);
      console.error('📄 Original response preview:', response.substring(0, 500) + '...');

      // 尝试找到问题位置
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

      // 最后的尝试：使用正则表达式提取Quiz内容
      console.log('🔄 尝试使用正则表达式提取Quiz内容...');
      const extractedQuiz = this.extractQuizFromText(response);
      if (extractedQuiz) {
        console.log('✅ 成功从文本中提取Quiz内容');
        return extractedQuiz;
      }

      throw new Error(`Invalid quiz response format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从文本中提取Quiz内容（备用方案）
   */
  private extractQuizFromText(text: string): any | null {
    try {
      console.log('🔍 尝试从文本中提取Quiz结构...');

      // 尝试提取标题
      const titleMatch = text.match(/["']?title["']?\s*:\s*["']([^"']+)["']/i) ||
        text.match(/标题[：:]\s*["']?([^"'\n]+)["']?/i);
      const title = titleMatch ? titleMatch[1].trim() : '自动生成的测验';

      // 尝试提取问题
      const questions = [];

      // 匹配问题模式
      const questionPatterns = [
        /问题\s*\d*[：:]\s*([^?\n]+\?)/gi,
        /["']?question["']?\s*:\s*["']([^"']+)["']/gi,
        /\d+\.\s*([^?\n]+\?)/gi
      ];

      let questionMatches: RegExpMatchArray[] = [];
      for (const pattern of questionPatterns) {
        const matches = Array.from(text.matchAll(pattern));
        if (matches.length > 0) {
          questionMatches = matches;
          break;
        }
      }

      // 提取选项和答案
      for (let i = 0; i < Math.min(questionMatches.length, 5); i++) {
        const questionText = questionMatches[i][1].trim();

        // 尝试找到这个问题后面的选项
        const questionIndex = text.indexOf(questionMatches[i][0]);
        const nextQuestionIndex = i + 1 < questionMatches.length ?
          text.indexOf(questionMatches[i + 1][0]) : text.length;

        const questionSection = text.substring(questionIndex, nextQuestionIndex);

        // 提取选项
        const optionMatches = questionSection.match(/[A-D][）)]\s*([^\n]+)/g) ||
          questionSection.match(/["']?options?["']?\s*:\s*\[([^\]]+)\]/i);

        let options = ['选项A', '选项B', '选项C', '选项D'];
        if (optionMatches && optionMatches.length >= 4) {
          options = optionMatches.slice(0, 4).map(opt =>
            opt.replace(/^[A-D][）)]?\s*/, '').trim()
          );
        }

        // 提取正确答案
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
    } catch (error) {
      console.error('❌ 正则表达式提取失败:', error);
      return null;
    }
  }

  /**
   * 构建测验生成提示词
   */
  private buildQuizGenerationPrompt(text: string, options: any = {}): string {
    const {
      questionCount = 5,
      difficulty = 'medium',
      timeLimit = 10
    } = options;

    // 检测内容语言
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
    } else {
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

export const xfyunAiService = new XfyunAiService();
