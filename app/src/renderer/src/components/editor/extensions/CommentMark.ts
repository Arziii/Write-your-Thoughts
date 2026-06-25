import { Mark, mergeAttributes } from '@tiptap/core'

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment mark
       */
      setComment: (commentId: string) => ReturnType
      /**
       * Unset a comment mark
       */
      unsetComment: (commentId: string) => ReturnType
    }
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {}
          }
          return {
            'data-comment-id': attributes.commentId,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'comment-mark' }), 0]
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId })
        },
      unsetComment:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false

          const { doc } = tr
          let hasMark = false

          doc.descendants((node, pos) => {
            const marks = node.marks
            const commentMark = marks.find(
              mark => mark.type.name === this.name && mark.attrs.commentId === commentId
            )

            if (commentMark) {
              hasMark = true
              tr.removeMark(pos, pos + node.nodeSize, commentMark.type)
            }
          })

          return hasMark
        },
    }
  },
})
