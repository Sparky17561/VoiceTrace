import React, { useContext } from 'react';
import { Text } from 'react-native';
import { AppContext } from './AppContext';

export default function AppText({ style, children, ...props }) {
  const { fontSizeScale = 1 } = useContext(AppContext) || {};
  
  // Flatten style array or use raw object
  const flattenStyle = Array.isArray(style) 
    ? Object.assign({}, ...style) 
    : (style || {});
    
  let scaledStyle = { ...flattenStyle };
  
  if (scaledStyle.fontSize) {
    scaledStyle.fontSize = scaledStyle.fontSize * fontSizeScale;
  }
  
  if (scaledStyle.lineHeight) {
    scaledStyle.lineHeight = scaledStyle.lineHeight * fontSizeScale;
  }

  return <Text style={scaledStyle} {...props}>{children}</Text>;
}
