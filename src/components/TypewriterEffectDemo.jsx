"use client";
import { TypewriterEffect } from "../components/ui/typewriter-effect";

export function TypewriterEffectDemo() {
  const words = [  //A client-side secure P2P file sharing app optimized for low-bandwidth conditions.
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
      
      <TypewriterEffect words={words} />
      
    </div>
  );
}
