const React = require('react');
const ReactDOMClient = require('react-dom/client');

global.React = React;
global.ReactDOMClient = ReactDOMClient;
global.ReactDOM = ReactDOMClient;

if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOMClient = ReactDOMClient;
  window.ReactDOM = ReactDOMClient;
}

require('@testing-library/jest-dom');
