import React from 'react';
import { useChat } from '@ai-sdk/react';

export function Test() {
  const chat = useChat({ api: '/api/chat' });
  console.log(Object.keys(chat));
  return <div>Test</div>;
}
