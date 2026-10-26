import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHyperFramesOptions, buildHyperFramesHtml } from './render-hyperframes-preview.mjs';

describe('HyperFrames Preview Generator', () => {
  describe('parseHyperFramesOptions', () => {
    it('requires --url and --output', () => {
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'https://demo.vercel.app']),
        /Required: --url HTTPS_PREVIEW --output FILE\.mp4/
      );
    });

    it('rejects invalid or unsafe preview URLs', () => {
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'http://malicious.com', '--output', 'test.mp4']),
        /Invalid preview URL/
      );
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'https://attacker.vercel.app:8080', '--output', 'test.mp4']),
        /Invalid preview URL/
      );
    });

    it('accepts valid HTTPS *.vercel.app URL and assigns defaults', () => {
      const opts = parseHyperFramesOptions([
        '--url', 'https://labdits-4-demo.vercel.app',
        '--output', 'preview.mp4',
      ]);
      assert.equal(opts.output, 'preview.mp4');
      assert.equal(opts.duration, 6);
      assert.equal(opts.fps, 30);
      assert.equal(opts.name, 'Demo Aplikasi');
      assert.equal(opts.slug, 'demo');
    });

    it('parses custom duration, fps, name, and slug', () => {
      const opts = parseHyperFramesOptions([
        '--url', 'https://labdits-4-demo.vercel.app',
        '--output', 'preview.mp4',
        '--duration', '8',
        '--fps', '24',
        '--name', 'Coffer Finance',
        '--slug', 'coffer',
      ]);
      assert.equal(opts.duration, 8);
      assert.equal(opts.fps, 24);
      assert.equal(opts.name, 'Coffer Finance');
      assert.equal(opts.slug, 'coffer');
    });

    it('rejects duration outside [2, 20]', () => {
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'https://demo.vercel.app', '--output', 'p.mp4', '--duration', '1']),
        /Duration must be an integer from 2 to 20/
      );
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'https://demo.vercel.app', '--output', 'p.mp4', '--duration', '25']),
        /Duration must be an integer from 2 to 20/
      );
    });

    it('rejects output format other than mp4/webm', () => {
      assert.throws(
        () => parseHyperFramesOptions(['--url', 'https://demo.vercel.app', '--output', 'test.avi']),
        /Output must end with \.mp4 or \.webm/
      );
    });
  });

  describe('buildHyperFramesHtml', () => {
    it('generates compliant HTML with required HyperFrames contract attributes', () => {
      const html = buildHyperFramesHtml({
        slug: 'coffer-app',
        name: 'Coffer Accounting',
        duration: 6,
      });

      assert.ok(html.includes('data-composition-id="main"'));
      assert.ok(html.includes('data-duration="6"'));
      assert.ok(html.includes('assets/app-preview.png'));
      assert.ok(html.includes('labdits.demo/coffer-app'));
      assert.ok(html.includes('Coffer Accounting'));
      assert.ok(html.includes('window.__timelines["main"] = tl;'));
      assert.ok(html.includes('class="window-header"'));
      assert.ok(html.includes('class="dot dot-red"'));
      assert.ok(html.includes('id="app-screenshot-carrier"'));
      assert.ok(html.includes('id="feature-badge"'));
    });

    it('escapes unsafe characters in name and slug', () => {
      const html = buildHyperFramesHtml({
        slug: 'evil/slug<script>',
        name: 'App <script>alert(1)</script>',
        duration: 5,
      });

      assert.ok(!html.includes('<script>alert(1)</script>'));
      assert.ok(!html.includes('evil/slug'));
      assert.ok(html.includes('labdits.demo/evilslugscript'));
    });
  });
});
