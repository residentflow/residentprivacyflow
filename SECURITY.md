# Security Policy

## Supported Versions

Currently, the following versions of ResidentPrivacyFlow are supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |

## Reporting a Vulnerability

**IMPORTANT: ResidentPrivacyFlow is a local-first application.** It does not transmit data over the network and operates entirely offline. This design inherently mitigates many typical cloud-based security risks.

If you discover a security vulnerability, please report it privately. **Do not create a public issue for security-related bugs.**

To report a vulnerability, please send an email to [stefan@residentflow.de](mailto:stefan@residentflow.de).

Please include the following in your report:
- A description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact.
- Any suggested fixes.

We will acknowledge your report within 48 hours and provide a timeline for our response.

## Security Features
- **Local Execution**: All processing happens on the user's machine.
- **Privacy by Design**: No telemetry, no cloud sync, no tracking.
- **Data Integrity**: Document modifications are handled securely within the Electron sandbox.
