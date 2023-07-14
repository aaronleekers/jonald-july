'use client'
import {
  useState, useEffect, useRef
} from 'react'
import styles from './page.module.css'
import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from 'openai';
// import Anthropic from '@anthropic-ai/sdk'
const apiKey = process.env.OPENAI_API_KEY;

// in da future
//const apikey2 = "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"
//const anthropic = new Anthropic({
//  apiKey: apikey2,
//});;

function Home(): JSX.Element {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatLog, setChatLog] = useState<{user: string, message: string}[]>([]);
  const [status, setStatus ] = useState('')
  const [selectedCard, setSelectedCard] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // What needs to be done:
  // Coffey Search - Coffey Write
  // Coffey Search:
  // - Jira
  // - Confluence Docs
  // - Tangos
  // - HR resources

  // Coffey Write:
  // - Internet search
  // - Creation workflow
  // - Health Library search
  // - Assistant for misc notes
  

  // 6/12/23 - wph - project coordinator => wps not updated
  
  async function createIndexAndEmbeddings() {
    try {
      const result = await fetch('/api/setup', {
        method: "POST"
      })
      const json = await result.json()
      console.log('result: ', json)
    } catch (err) {
      console.log('err:', err)
    }
  }
  async function sendQuery() {
    if (!query) return
    setResult('')
    setLoading(true)
    try {
      const result = await fetch('/api/read', {
        method: "POST",
        body: JSON.stringify(query)
      })
      const json = await result.json()
      setResult(json.data)
      setLoading(false)
    } catch (err) {
      console.log('err:', err)
      setLoading(false)
    }
  }

  const configuration = new Configuration({
    apiKey: apiKey,
  });
  const openai = new OpenAIApi(configuration);

  async function getResponse2(query: string, context: string, messages: ChatCompletionRequestMessage[]): Promise<string> {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages: [
      //  { role: 'system', content: `You are an assistant designed to receive context and explain it by answering the question. Answer the question directly, and only use the context given to answer the question. If the context given is not sufficient, mention that, and don't attempt to answer the question. Keep answers clear and direct, don't overexplain simple questions, and don't underexplain complex questions.`},
        ...messages,
        { role: "system", content:`Output this context: ${context}`},
       // { role: 'user', content: `${query}`},
      ],
      temperature: 0.5,
      stop: "",
    })
    const choices = response.data.choices;
    const data = choices[choices.length-1]?.message;
    return data?.content ?? '';
  }
  async function getResponse(query: string): Promise<string> {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages: [
      //  { role: 'system', content: `You are an assistant designed to receive context and explain it by answering the question. Answer the question directly, and only use the context given to answer the question. If the context given is not sufficient, mention that, and don't attempt to answer the question. Keep answers clear and direct, don't overexplain simple questions, and don't underexplain complex questions.`},
        { role: "system", content:`Prompt: ${query}`},
       // { role: 'user', content: `${query}`},
      ],
      temperature: 0.5,
      stop: "",
    })
    const choices = response.data.choices;
    const data = choices[choices.length-1]?.message;
    return data?.content ?? '';
  }

  async function pdfLoad(); 

  async function webLoad();

  async function sourceDraft();

  async function formatDraft();

  async function handleSubmit23(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() && query.length > 4) {
      setQuery('');
      setLoading(true);
      let chatLogNew = [...chatLog, { user: "me", message: `${query}` }];
      setChatLog(chatLogNew);
      const messages = chatLogNew.map((message) => ({
        role: 'user' as 'user', 
        content: message.message
      } as ChatCompletionRequestMessage));
      pdfLoad();
      webLoad();
      const firstDraft = await getResponse(query);
      setChatLog([...chatLogNew, { user: "gpt", message: `${firstDraft}` }]);
      // ask for approval by placing a button below chatlog. If approved, continue, if denied, run getResponse and setChatLog again.
      sourceDraft();
      // ask for approval, if approved, continue, if denied, prompt why, run getResponse and setChatLog again, but modify getResponse to include edit notes.
      formatDraft();
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    //createIndexAndEmbeddings();
    e.preventDefault();
    if (query.trim() && query.length > 4) {
      setQuery("");
      setLoading(true);
      let chatLogNew = [...chatLog, { user: "me", message: `${query}` }];
      setChatLog(chatLogNew);
      const messages = chatLogNew.map((message) => ({ 
        role: 'user' as 'user', 
        content: message.message 
      } as ChatCompletionRequestMessage));
      const result = await fetch('/api/read', {
        method: "POST",
        body: JSON.stringify(query)
      })
      const json = await result.json()
      const context = await JSON.stringify(json)
     // const data = await getResponse(query, context, messages);
     const data = await getResponse(query, context, messages); 
     setChatLog([...chatLogNew, { user: "gpt", message: `${data}` }]);
      setLoading(false);
      setQuery("")
    }
  }

  const updateStatus = (newStatus: string) => {
    setStatus(newStatus);
  };

    // User experience optimizations
  //scrolls to bottom to match new chats
  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);
  // clears chat when reset button is clicked
  function clearChat() {
    setChatLog([]);
    setQuery("");
    setLoading(false);
    setSelectedCard('');
  }
  // selects text box by default so u dont gotta click
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [chatLog]);
  // scrolls to bottom based on chatlog
  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  // allows u to submit by pressing enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCardSelection = (cardName: string) => {
    setSelectedCard(cardName);
    
  };

  return (
    <div className={styles.App}>
      <aside className={styles.sidemenu}>
        <h3 className={styles['sidemenu-header']}>Coffey Content Tool</h3>
        <button className={styles['side-menu-button']} onClick={clearChat}>
          Reset
        </button>
        <div>
          {status}
        </div>
      </aside>
      <section className={styles.chatbox}>
        <div className={styles['chat-log']}>
          {chatLog.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          {selectedCard === '' && (
            <div className={styles.cardSelection}>
              <div className={styles.cardContainer}>
                <div
                  className={`${styles.card}`}
                  onClick={() => handleCardSelection('write')}
                >
                  <p>Write content</p>
                </div>
                <div
                  className={`${styles.card}`}
                  onClick={() => handleCardSelection('search')}
                >
                  <p>Search for internal resources</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {selectedCard !== '' && (
          <div className={styles['chat-input-holder']}>
            <div className={styles['bottom-area']}>
              <form onSubmit={handleSubmit}>
                <div className={styles['input-field-container']}>
                  <textarea
                    rows={1}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles['chat-input-textarea']}
                    placeholder={loading ? 'Loading...' : 'Ask a question or give a command'}
                    disabled={loading}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    ref={textareaRef}
                  />
                  {/*...*/}
                  <button
                    className={styles['submit-button']}
                    onClick={handleSubmit}
                    type="button"
                    disabled={loading}
                  >
                    <strong>&gt;</strong>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface ChatMessageProps {
  message: { user: string, message: string }; 
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const paragraphs = message.message.split("\n"); 

  return (
    <div className={styles.clearfix}>
      <div className={`chat-message ${message.user === 'gpt' ? styles.chatgpt : ''}`}>
        <div className={styles['chat-message-center']}/>
        <div className={styles.message}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={styles.paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
