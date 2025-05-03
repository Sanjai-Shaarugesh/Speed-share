import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import { useState, useEffect } from 'react';
 import { Capacitor } from '@capacitor/core';

export function ContainerTextFlipDemo() {
  
  let [isNative , setIsNative] = useState(false);
  
  useEffect(()=>{
    setIsNative(Capacitor.isNativePlatform());
  })
  
  return (
    <div className="flex items-center justify-center ">
     {!isNative ? (
       <ContainerTextFlip 
         words={["better", "modern", "faster", "smarter" ,"secure", "reliable"]} 
         className="w-48 h-16 my-8"  
       />
     ) : (
     null
     )}
    </div>
  );
}
