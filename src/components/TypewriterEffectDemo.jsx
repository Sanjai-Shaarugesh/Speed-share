import { TypewriterEffect } from "../components/ui/typewriter-effect";
import { useState, useEffect } from 'react';
 import { Capacitor } from '@capacitor/core';
 import { pageDescription } from '../configs';
 
export function TypewriterEffectDemo() {
  
  let [ isNative, setIsNative] = useState(false);
  
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  });
  
  const words = [ 
    {
      text: "A",
    },
    {
      text: "client-side",
    },
    {
      text: "secure",
    },
    {
      text: "P2P",
    },
    {text : 'file'},
    {
      text: "sharing"},
      {
            text: 'app optimized'
      },
      {
       text: 'low-bandwidth conditions'
      },

    {
      text: "app",
      className: "text-blue-500 dark:text-blue-500",
    },
  ];
  return (
    <div className="flex flex-col items-center justify-center  ">
      
     {!isNative ? (
        <TypewriterEffect words={words} />
     ) : (
       <p class="text-center mb-4 xl:mb-8 my-4 sm:my-8 p-1">
        {pageDescription}
       </p>
     )}
      
    </div>
  );
}

