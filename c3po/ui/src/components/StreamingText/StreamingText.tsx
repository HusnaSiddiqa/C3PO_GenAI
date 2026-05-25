import React, { useState, useEffect, useRef } from 'react';
import { Box, keyframes } from '@mui/material';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';

// Typing cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

const Cursor = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-block',
      width: '2px',
      height: '1.2em',
      backgroundColor: 'primary.main',
      marginLeft: '2px',
      animation: `${blink} 1s infinite`,
      verticalAlign: 'text-bottom',
      borderRadius: '1px',
      boxShadow: '0 0 2px rgba(0, 0, 0, 0.1)',
    }}
  />
);

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
  showTechnicalDetails?: boolean; // New prop to control technical content visibility
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  content,
  isStreaming,
  speed = 20,
  onComplete,
  showTechnicalDetails = false, // Default to false for business users
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      // If not streaming, show full content immediately
      setDisplayedText(content);
      setIsAnimating(false);
      return;
    }

    // If streaming and content changed, start animation
    if (content !== displayedText && !isAnimating) {
      setIsAnimating(true);
      setDisplayedText('');
      
      let currentIndex = 0;
      
      const animateText = () => {
        if (currentIndex < content.length) {
          // For better markdown rendering, try to complete words/sentences
          let nextIndex = currentIndex + 1;
          
          // If we're in the middle of a word, complete it
          if (currentIndex < content.length - 1 && content[currentIndex] !== ' ' && content[nextIndex] !== ' ') {
            // Find the end of the current word
            while (nextIndex < content.length && content[nextIndex] !== ' ' && content[nextIndex] !== '\n') {
              nextIndex++;
            }
          }
          
          // If we're in the middle of a sentence, try to complete it
          if (nextIndex < content.length - 1 && content[nextIndex] === ' ') {
            const sentenceEnd = content.indexOf('.', nextIndex);
            if (sentenceEnd !== -1 && sentenceEnd < nextIndex + 50) { // Complete short sentences
              nextIndex = sentenceEnd + 1;
            }
          }
          
          setDisplayedText(content.slice(0, nextIndex));
          currentIndex = nextIndex;
          timeoutRef.current = setTimeout(animateText, speed);
        } else {
          setIsAnimating(false);
          onComplete?.();
        }
      };
      
      animateText();
    }
  }, [content, isStreaming, speed, onComplete, displayedText, isAnimating]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // If not streaming or animation is complete, show full content with markdown
  if (!isStreaming || !isAnimating) {
    return <MarkdownRenderer showTechnicalDetails={showTechnicalDetails}>{content}</MarkdownRenderer>;
  }

  // During streaming, show animated text with cursor
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start',
      '& .markdown': {
        transition: 'all 0.1s ease-out',
      }
    }}>
      <MarkdownRenderer showTechnicalDetails={showTechnicalDetails}>{displayedText}</MarkdownRenderer>
      <Cursor />
    </Box>
  );
};

export default StreamingText; 