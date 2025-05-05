import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function ContainerTextFlipDemo() {
  
  const [platformChecked, setPlatformChecked] = useState(false);
  const [isNative, setIsNative] = useState(true); 
  
  useEffect(() => {
    
    setIsNative(Capacitor.isNativePlatform());
    
    setPlatformChecked(true);
  }, []); 
  
  return (
    <div className="flex items-center justify-center">
      {platformChecked && !isNative && (
        <ContainerTextFlip 
          words={["better", "modern", "faster", "smarter", "secure", "reliable"]} 
          className="w-48 h-16 my-8"  
        />
      )}
    </div>
  );
}