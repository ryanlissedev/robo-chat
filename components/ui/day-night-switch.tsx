'use client';

import {
  AnimatePresence,
  type MotionProps,
  motion,
  type Variants,
} from 'framer-motion';
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type DayNightSwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onToggle?: (checked: boolean) => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onToggle'> &
  Omit<MotionProps, 'onToggle'>;

type AnimationMode = keyof typeof backgroundVariants;

const backgroundVariants: Variants = {
  day: {
    background: 'linear-gradient(to bottom, #87CEEB, #E0F7FA)',
    transition: { duration: 0.7 },
  },
  sunset: {
    background: 'linear-gradient(to bottom, #FF7E5F, #FEB47B, #D76D77)',
    transition: { duration: 0.7 },
  },
  night: {
    background: 'linear-gradient(to bottom, #0F2027, #203A43, #2C5364)',
    transition: { duration: 0.7 },
  },
};

const sunVariants: Variants = {
  visible: { y: 0, opacity: 1 },
  sunset: { y: 24, opacity: 0.9, scale: 1.2, transition: { duration: 0.7 } },
  hidden: { y: 40, opacity: 0, transition: { duration: 0.4 } },
};

const moonVariants: Variants = {
  hidden: { y: -30, opacity: 0 },
  rising: { y: 0, opacity: 1, transition: { delay: 0.5, duration: 0.7 } },
};

const cloudVariants: Variants = {
  visible: { opacity: 0.9, x: 0 },
  hidden: { opacity: 0, x: -30, transition: { duration: 0.5 } },
};

const createStarVariants = (index: number): Variants => ({
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: [0, 0.8, 0.6 + Math.random() * 0.4],
    scale: [0, 0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.4],
    transition: {
      delay: 0.7 + index * 0.12,
      duration: 0.8,
    },
  },
});

const DayNightSwitch = React.forwardRef<HTMLDivElement, DayNightSwitchProps>(
  (
    {
      className,
      checked: controlledChecked,
      defaultChecked = true,
      onToggle,
      ...restProps
    },
    ref
  ) => {
    // Use a stable ID to avoid hydration mismatches
    const id = React.useId();
    const [internalChecked, setInternalChecked] =
      React.useState<boolean>(defaultChecked);

    // Use controlled value if provided, otherwise use internal state
    const checked =
      controlledChecked !== undefined ? controlledChecked : internalChecked;

    const handleToggle = (newValue: boolean) => {
      // Only update internal state if not controlled
      if (controlledChecked === undefined) {
        setInternalChecked(newValue);
      }
      onToggle?.(newValue);
    };

    const currentMode: AnimationMode = checked ? 'day' : 'night';

    return (
      <motion.div
        animate={currentMode}
        className={cn(
          'relative h-10 w-20 overflow-hidden rounded-md border shadow',
          className
        )}
        data-testid="day-night-switch"
        initial={currentMode}
        ref={ref}
        variants={backgroundVariants}
        {...restProps}
      >
        <div className="relative h-full w-full">
          <AnimatePresence>
            {checked && (
              <motion.div
                animate={checked ? 'visible' : 'sunset'}
                className="absolute h-6 w-6 rounded-full bg-yellow-400"
                exit="hidden"
                initial="visible"
                style={{
                  left: '25%',
                  top: '50%',
                  marginTop: -12,
                  marginLeft: -12,
                }}
                variants={sunVariants}
              >
                <SunRays />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!checked && (
              <motion.div
                animate={checked ? 'hidden' : 'rising'}
                className="absolute h-5 w-5"
                initial="hidden"
                style={{
                  left: '75%',
                  top: '50%',
                  marginTop: -10,
                  marginLeft: -10,
                }}
                variants={moonVariants}
              >
                <Moon />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>{checked && <Clouds />}</AnimatePresence>

          <AnimatePresence>{!checked && <Stars count={10} />}</AnimatePresence>

          <div className="absolute inset-0 flex items-center justify-center">
            <Switch
              checked={checked}
              className={cn(
                'peer absolute inset-0 h-[inherit] w-auto data-[state=checked]:bg-transparent data-[state=unchecked]:bg-transparent [&_span]:z-10 [&_span]:size-6 [&_span]:rounded-sm [&_span]:border [&_span]:border-gray-300 [&_span]:bg-white [&_span]:shadow [&_span]:transition-transform [&_span]:duration-500 [&_span]:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=checked]:translate-x-10 [&_span]:data-[state=unchecked]:translate-x-2'
              )}
              id={id}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>

        <Label className="sr-only" htmlFor={id}>
          Day/Night Theme Switch
        </Label>
      </motion.div>
    );
  }
);

const SunRays = () => (
  <>
    {[...Array(8)].map((_, i) => (
      <div
        className="absolute h-2 w-1 bg-yellow-300"
        key={`ray-${i}`}
        style={{
          left: '50%',
          top: '50%',
          transformOrigin: '0 0',
          transform: `rotate(${
            i * 45
          }deg) translate(-50%, -50%) translate(10px, 0)`,
        }}
      />
    ))}
  </>
);

const Moon = () => (
  <div className="relative h-full w-full">
    <div className="absolute inset-0 rounded-full bg-gray-100" />
    <div
      className="absolute rounded-full bg-[#0F2027]"
      style={{
        width: '90%',
        height: '90%',
        top: '-10%',
        left: '-25%',
      }}
    />
  </div>
);

const Clouds = () => (
  <>
    <motion.div
      animate="visible"
      className="absolute top-[30%] left-[60%] h-3 w-8 rounded-full bg-white opacity-90"
      exit="hidden"
      initial="visible"
      variants={cloudVariants}
    />
    <motion.div
      animate="visible"
      className="absolute top-[60%] left-[70%] h-2.5 w-6 rounded-full bg-white opacity-80"
      exit="hidden"
      initial="visible"
      variants={cloudVariants}
    />
  </>
);

type StarsProps = {
  count: number;
};

const Stars = ({ count }: StarsProps) => (
  <>
    {[...Array(count)].map((_, i) => (
      <motion.div
        animate="visible"
        className="absolute h-0.5 w-0.5 rounded-full bg-white"
        exit="hidden"
        initial="hidden"
        key={`star-${i}`}
        style={{
          left: `${10 + i * 8}%`,
          top: `${20 + (i % 5) * 12}%`,
          boxShadow: '0 0 2px 1px rgba(255, 255, 255, 0.4)',
        }}
        variants={createStarVariants(i)}
      />
    ))}
  </>
);

DayNightSwitch.displayName = 'DayNightSwitch';

export { DayNightSwitch };
