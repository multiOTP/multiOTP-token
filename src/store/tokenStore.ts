import { TokenInterface } from '@/interfaces'
import { defineStore } from 'pinia'

export interface TokenState {
  tokens: TokenInterface[]
  editTokenId: string | null
}

export const useTokens = defineStore('tokens', {
  state: (): TokenState => ({
    tokens: [],
    editTokenId: null,
  }),
  getters: {
    tokensList(state: TokenState): TokenInterface[] {
      return state.tokens
    },
    getTokenById(state: TokenState) {
      return (id: string | null): TokenInterface | null => {
        if (id) {
          return state.tokens.find((token) => token.id === id) ?? null // ?? null to return null instead of undefined
        } else {
          return null
        }
      } // Function used to be able to pass parameters to the getter
    },
    getTokenByMouid(state: TokenState) {
      return (mouid: string | null): TokenInterface | null => {
        if (mouid) {
          return state.tokens.find((token) => token.mouid === mouid) ?? null // ?? null to return null instead of undefined
        } else {
          return null
        }
      } // Function used to be able to pass parameters to the getter
    },
    tokenExists(state: TokenState) {
      return (id: string, secret: string): boolean => {
        return (
          state.tokens.find(
            (token) => token.id === id && token.secret === secret
          ) !== undefined
        )
      }
    },
  },
  actions: {
    loadTokens(tokens: TokenInterface[]) {
      this.tokens = tokens
    },
    addToken(token: TokenInterface) {
      this.tokens.push(token)
    },
    removeToken(id: string) {
      this.tokens = this.tokens.filter((token) => token.id !== id)
    },
    setTokenToEdit(id: string | null) {
      this.editTokenId = id
    },
  },
})
