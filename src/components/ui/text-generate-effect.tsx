"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "src/utils.ts";

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 1,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const wordsArray = words.split(" ");

  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration,
        delay: stagger(0.2),
      }
    );
  }, [scope.current]);

  const renderWords = () => (
    <motion.div
      ref={scope}
      className="text-blue-600 dark:text-sky-400 flex flex-wrap justify-center text-center"
    >
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="opacity-0"
          style={{
            filter: filter ? "blur(10px)" : "none",
            color: "inherit",
          }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </motion.div>
  );

  return (
    <div
      className={cn(
        "font-medium px-4 md:px-8 w-full max-w-5xl mx-auto text-center",
        className
      )}
    >
      <div className="mt-4 mb-10 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl leading-snug tracking-wide">
        {renderWords()}
      </div>
    </div>
  );
};
