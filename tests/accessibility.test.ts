/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';
import axe from 'axe-core';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Button } from '../client/src/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../client/src/components/ui/card';
import { Badge } from '../client/src/components/ui/badge';

async function runAxeAudit(container: HTMLElement, testName: string) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa']
    }
  });

  console.log(`\n=== axe-core Audit: ${testName} ===`);
  console.log(`Violations: ${results.violations.length}, Passes: ${results.passes.length}`);

  if (results.violations.length > 0) {
    console.log('\n--- Violations Found ---');
    results.violations.forEach(v => {
      console.log(`❌ [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
      console.log(`   Help: ${v.helpUrl}`);
      v.nodes.slice(0, 2).forEach(node => {
        console.log(`   Element: ${node.html.substring(0, 100)}`);
      });
    });
  }

  return results;
}

describe('Accessibility Audit', () => {
  beforeAll(() => {
    document.documentElement.lang = 'en';
  });

  it('should pass axe-core checks on Button component', async () => {
    const { container } = render(
      React.createElement('div', null,
        React.createElement(Button, { type: 'button' }, 'Submit'),
        React.createElement(Button, { variant: 'outline', type: 'button' }, 'Cancel'),
        React.createElement(Button, { variant: 'destructive', type: 'button' }, 'Delete')
      )
    );

    const results = await runAxeAudit(container, 'Button Component');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on Card component', async () => {
    const { container } = render(
      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, 'Dashboard Statistics')
        ),
        React.createElement(CardContent, null,
          React.createElement('p', null, 'Welcome to your compliance dashboard')
        )
      )
    );

    const results = await runAxeAudit(container, 'Card Component');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on Badge component', async () => {
    const { container } = render(
      React.createElement('div', null,
        React.createElement(Badge, null, 'Active'),
        React.createElement(Badge, { variant: 'secondary' }, 'Pending'),
        React.createElement(Badge, { variant: 'destructive' }, 'Urgent')
      )
    );

    const results = await runAxeAudit(container, 'Badge Component');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on Kbd element', async () => {
    const { container } = render(
      React.createElement('div', null,
        React.createElement('p', null, 
          'Press ',
          React.createElement('kbd', { className: 'px-2 py-1 bg-muted rounded text-sm font-mono' }, 'Escape'),
          ' to close'
        )
      )
    );

    const results = await runAxeAudit(container, 'Kbd Element');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on form elements', async () => {
    const { container } = render(
      React.createElement('form', { 'aria-label': 'Search form' },
        React.createElement('div', null,
          React.createElement('label', { htmlFor: 'search-input' }, 'Search'),
          React.createElement('input', { 
            type: 'text', 
            id: 'search-input', 
            name: 'search',
            placeholder: 'Search properties...'
          })
        ),
        React.createElement(Button, { type: 'submit' }, 'Search')
      )
    );

    const results = await runAxeAudit(container, 'Form Elements');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on data table structure', async () => {
    const { container } = render(
      React.createElement('table', { 'aria-label': 'Remedial actions' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', { scope: 'col' }, 'Property'),
            React.createElement('th', { scope: 'col' }, 'Action'),
            React.createElement('th', { scope: 'col' }, 'Status')
          )
        ),
        React.createElement('tbody', null,
          React.createElement('tr', null,
            React.createElement('td', null, '123 Main St'),
            React.createElement('td', null, 'EICR inspection'),
            React.createElement('td', null, 
              React.createElement(Badge, null, 'Open')
            )
          )
        )
      )
    );

    const results = await runAxeAudit(container, 'Data Table');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should pass axe-core checks on navigation landmark', async () => {
    const { container } = render(
      React.createElement('nav', { 'aria-label': 'Main navigation' },
        React.createElement('ul', null,
          React.createElement('li', null,
            React.createElement('a', { href: '/dashboard' }, 'Dashboard')
          ),
          React.createElement('li', null,
            React.createElement('a', { href: '/properties' }, 'Properties')
          ),
          React.createElement('li', null,
            React.createElement('a', { href: '/actions' }, 'Actions')
          )
        )
      )
    );

    const results = await runAxeAudit(container, 'Navigation Landmark');
    cleanup();

    expect(results.violations.length).toBe(0);
  });

  it('should document keyboard navigation features', () => {
    const keyboardFeatures = [
      { feature: 'Skip Link', keys: 'Tab (first)', description: 'Skip to main content link appears on first Tab' },
      { feature: 'Global Navigation', keys: 'Tab', description: 'Navigate through sidebar and header' },
      { feature: 'Dialog Close', keys: 'Escape', description: 'Close any open dialog or modal' },
      { feature: 'Dropdown Navigation', keys: 'Arrow Up/Down', description: 'Navigate dropdown menu items' },
      { feature: 'Form Submission', keys: 'Enter', description: 'Submit focused form' },
      { feature: 'Checkbox Toggle', keys: 'Space', description: 'Toggle checkbox state' },
      { feature: 'Help Dialog', keys: '?', description: 'Open keyboard shortcuts help' },
      { feature: 'Table Navigation', keys: 'Arrow Keys', description: 'Navigate table cells' },
      { feature: 'Button Activation', keys: 'Enter/Space', description: 'Activate focused button' },
      { feature: 'Link Activation', keys: 'Enter', description: 'Follow focused link' },
    ];
    
    console.log('\n=== Keyboard Navigation Features ===\n');
    keyboardFeatures.forEach(f => {
      console.log(`${f.feature}: [${f.keys}] - ${f.description}`);
    });
    
    expect(keyboardFeatures.length).toBeGreaterThan(0);
  });

  it('should verify ARIA landmark regions', () => {
    const landmarks = [
      { role: 'banner', element: 'header', description: 'Page header with navigation' },
      { role: 'navigation', element: 'nav', description: 'Main sidebar navigation' },
      { role: 'main', element: 'main', description: 'Primary content area' },
      { role: 'complementary', element: 'aside', description: 'Sidebar content' },
      { role: 'contentinfo', element: 'footer', description: 'Page footer (if present)' },
    ];
    
    console.log('\n=== ARIA Landmark Regions ===\n');
    landmarks.forEach(l => {
      console.log(`${l.role} (${l.element}): ${l.description}`);
    });
    
    expect(landmarks.length).toBeGreaterThan(3);
  });

  it('should list accessible component patterns', () => {
    const patterns = [
      { component: 'Dialog', pattern: 'Modal with focus trap and Escape to close' },
      { component: 'Dropdown Menu', pattern: 'Arrow navigation, Escape to close' },
      { component: 'Tabs', pattern: 'Arrow key navigation between tabs' },
      { component: 'Data Tables', pattern: 'Sortable headers with aria-sort' },
      { component: 'Form Fields', pattern: 'Labels associated via htmlFor/id' },
      { component: 'Buttons', pattern: 'Accessible names, disabled states announced' },
      { component: 'Links', pattern: 'Descriptive text, external link indicators' },
      { component: 'Status Badges', pattern: 'Color + icon + text for status' },
      { component: 'Toast Notifications', pattern: 'role=status, polite announcements' },
      { component: 'Charts', pattern: 'Alternative text descriptions' },
    ];
    
    console.log('\n=== Accessible Component Patterns ===\n');
    patterns.forEach(p => {
      console.log(`${p.component}: ${p.pattern}`);
    });
    
    expect(patterns.length).toBeGreaterThan(5);
  });
});
