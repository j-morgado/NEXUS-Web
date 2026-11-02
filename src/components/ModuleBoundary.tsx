import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; onExit: () => void }
type State = { error: string | null; retryKey: number }

export class ModuleBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error: error.message || 'The module could not load.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NEXUS module failure', error, info.componentStack)
  }

  render() {
    if (this.state.error) return <main className="module-recovery">
      <p className="eyebrow">MODULE INTERRUPTED</p>
      <h1>JLTV is temporarily unavailable.</h1>
      <p>The platform selector remains available. Retry the module now or return without restarting the experience.</p>
      <div><button className="primary-cta" onClick={() => this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }))}>Retry module <span>↻</span></button><button className="back-button recovery-back" onClick={this.props.onExit}>Return to platforms</button></div>
    </main>
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}
