import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'Ocorreu um erro inesperado na interface.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error && parsed?.operationType) {
        readable = `Erro de permissão ou sincronização (${parsed.operationType} em ${parsed.path || 'banco de dados'}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F7F5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#DCE4DF] rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-[#111B17] mb-2">
              Algo interrompeu esta tela
            </h2>
            <p className="text-sm text-[#52635B] mb-6 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-medium hover:bg-[#0F2B23] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar NUTRIX
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
