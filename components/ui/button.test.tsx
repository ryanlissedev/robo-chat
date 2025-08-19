// Import DOM setup FIRST
import '../../tests/setup.minimal'

import { describe, it, expect, beforeEach } from 'bun:test'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { Button } from './button'

describe('Button Component', () => {
  beforeEach(() => {
    cleanup()
  })

  it('should render with default props', () => {
    const { getByRole } = render(<Button>Click me</Button>)
    const button = getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('should handle click events', () => {
    let clicked = false
    const handleClick = () => { clicked = true }
    
    const { getByRole } = render(<Button onClick={handleClick}>Click me</Button>)
    const button = getByRole('button', { name: /click me/i })
    
    fireEvent.click(button)
    expect(clicked).toBe(true)
  })

  it('should be disabled when disabled prop is true', () => {
    const { getByRole } = render(<Button disabled>Disabled button</Button>)
    const button = getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  it('should apply variant classes correctly', () => {
    const { getByRole } = render(<Button variant="destructive">Delete</Button>)
    const button = getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive')
  })

  it('should apply size classes correctly', () => {
    const { getByRole } = render(<Button size="sm">Small button</Button>)
    const button = getByRole('button', { name: /small button/i })
    expect(button.className).toContain('h-8')
  })

  it('should render as different element when asChild is true', () => {
    const { getByRole } = render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    )
    const link = getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('should merge custom className with default classes', () => {
    const { getByRole } = render(<Button className="custom-class">Custom button</Button>)
    const button = getByRole('button', { name: /custom button/i })
    expect(button).toHaveClass('custom-class')
    expect(button).toHaveClass('inline-flex') // default class
  })

  it('should forward ref correctly', () => {
    let buttonRef: HTMLButtonElement | null = null
    
    render(
      <Button ref={(ref) => { buttonRef = ref }}>
        Ref button
      </Button>
    )
    
    expect(buttonRef).toBeInstanceOf(HTMLButtonElement)
  })

  describe('Variants', () => {
    it('should render default variant', () => {
      const { getByRole } = render(<Button variant="default">Default</Button>)
      const button = getByRole('button', { name: /default/i })
      expect(button).toHaveClass('bg-primary')
    })

    it('should render secondary variant', () => {
      const { getByRole } = render(<Button variant="secondary">Secondary</Button>)
      const button = getByRole('button', { name: /secondary/i })
      expect(button).toHaveClass('bg-secondary')
    })

    it('should render outline variant', () => {
      const { getByRole } = render(<Button variant="outline">Outline</Button>)
      const button = getByRole('button', { name: /outline/i })
      expect(button).toHaveClass('border-input')
    })

    it('should render ghost variant', () => {
      const { getByRole } = render(<Button variant="ghost">Ghost</Button>)
      const button = getByRole('button', { name: /ghost/i })
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('should render link variant', () => {
      const { getByRole } = render(<Button variant="link">Link</Button>)
      const button = getByRole('button', { name: /link/i })
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  describe('Sizes', () => {
    it('should render default size', () => {
      const { getByRole } = render(<Button size="default">Default size</Button>)
      const button = getByRole('button', { name: /default size/i })
      expect(button.className).toContain('h-9')
    })

    it('should render small size', () => {
      const { getByRole } = render(<Button size="sm">Small size</Button>)
      const button = getByRole('button', { name: /small size/i })
      expect(button.className).toContain('h-8')
    })

    it('should render large size', () => {
      const { getByRole } = render(<Button size="lg">Large size</Button>)
      const button = getByRole('button', { name: /large size/i })
      expect(button.className).toContain('h-10')
    })

    it('should render icon size', () => {
      const { getByRole } = render(<Button size="icon">Icon</Button>)
      const button = getByRole('button', { name: /icon/i })
      expect(button).toHaveClass('size-9')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when disabled', () => {
      const { getByRole } = render(<Button disabled>Disabled button</Button>)
      const button = getByRole('button', { name: /disabled button/i })
      expect(button.hasAttribute('disabled')).toBe(true)
    })

    it('should be focusable by default', () => {
      const { getByRole } = render(<Button>Focusable button</Button>)
      const button = getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })

    it('should not be focusable when disabled', () => {
      const { getByRole } = render(<Button disabled>Disabled button</Button>)
      const button = getByRole('button')
      button.focus()
      expect(button).not.toHaveFocus()
    })
  })
})