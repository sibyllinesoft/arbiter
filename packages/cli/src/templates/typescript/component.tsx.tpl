{{> header}}
import React from 'react';

export interface {{componentName}}Props {
{{{propsInterface}}}
}

export const {{componentName}}: React.FC<{{componentName}}Props> = ({{propsParam}}) => {
  return (
    <div className="{{containerClass}}">
      <h1>{{componentName}}</h1>
{{#hasProps}}
      <pre>{JSON.stringify({ props }, null, 2)}</pre>
{{/hasProps}}
    </div>
  );
};

{{#styles}}
import './{{componentName}}.module.css';
{{/styles}}

{{#tests}}
// Test scaffold
export const __test__ = () => '{{componentName}}';
{{/tests}}
