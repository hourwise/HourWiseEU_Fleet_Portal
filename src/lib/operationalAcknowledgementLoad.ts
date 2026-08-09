import { emptyManagerAcknowledgementReadModel, type ManagerAcknowledgementReadModel } from './operationalAcknowledgements';

export interface OperationalAcknowledgementLoadState {
  loading: boolean;
  error: string | null;
  requestToken: number;
  loadedScope: string;
  model: ManagerAcknowledgementReadModel;
}

export const INITIAL_OPERATIONAL_ACKNOWLEDGEMENT_LOAD: OperationalAcknowledgementLoadState = {
  loading: false,
  error: null,
  requestToken: 0,
  loadedScope: '',
  model: emptyManagerAcknowledgementReadModel(),
};

export type OperationalAcknowledgementLoadAction =
  | { type: 'begin'; requestToken: number; scope: string }
  | { type: 'resolve'; requestToken: number; scope: string; model: ManagerAcknowledgementReadModel | null; error: string | null };

export function operationalAcknowledgementLoadReducer(
  state: OperationalAcknowledgementLoadState,
  action: OperationalAcknowledgementLoadAction
): OperationalAcknowledgementLoadState {
  switch (action.type) {
    case 'begin':
      return {
        loading: true,
        error: null,
        requestToken: action.requestToken,
        loadedScope: '',
        model: emptyManagerAcknowledgementReadModel(),
      };
    case 'resolve':
      if (action.requestToken !== state.requestToken) return state;
      if (action.error) {
        return {
          ...state,
          loading: false,
          error: action.error,
          loadedScope: '',
          model: emptyManagerAcknowledgementReadModel(),
        };
      }
      return {
        ...state,
        loading: false,
        error: null,
        loadedScope: action.scope,
        model: action.model ?? emptyManagerAcknowledgementReadModel(),
      };
  }
}
