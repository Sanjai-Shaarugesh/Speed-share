import { Divide } from "lucide-react";
import { TextGenerateEffect } from "../components/ui/text-generate-effect";

const words = `A client-side secure P2P file sharing app optimized for low-bandwidth conditions`;

export function TextGenerateEffectDemo() {
    return (<div className='ml-50'>
        <TextGenerateEffect words={words} />
    </div>)
    
}
