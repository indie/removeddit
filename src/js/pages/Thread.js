import React from 'react'
import Post from 'components/Post'
import CommentSection from 'components/CommentSection'
import {
  getPost,
  getComments as getRedditComments,
} from 'api/reddit'
import {
  getPost as getRemovedPost,
  getComments as getPushshiftComments,
} from 'api/pushshift'
import { isDeleted, isRemoved } from 'utils'

export default class Thread extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      post: {},
      pushshiftComments: [],
      removed: [],
      deleted: [],
      loadingComments: true,
    }
  }

  componentDidMount() {
    const { subreddit, threadID } = this.props.match.params

    Promise.all([
      // Get thread from reddit
      getPost(subreddit, threadID)
        .then(post => {
          this.setState({ post })
          // Fetch the thread from pushshift if it was deleted/removed
          if (isDeleted(post.selftext)) {
            getRemovedPost(threadID)
              .then(removedPost => {
                removedPost.removed = true
                this.setState({ post: removedPost })
              })
          }
        }),
      // Get comment ids from pushshift
      getPushshiftComments(threadID),
    ])
      .then(results => {
        const pushshiftComments = results[1]

        // Extract ids from pushshift response
        const ids = pushshiftComments.map(comment => comment.id)
        console.log('Number of comments from Pushshift:', ids.length)

        // Get all the comments from reddit
        return (
          getRedditComments(ids)
            .then(redditComments => {
              const redditCommentLookup = {}
              redditComments.forEach(comment => {
                redditCommentLookup[comment.id] = comment
              })

              pushshiftComments.forEach(comment => {
                // Replace pushshift score with reddit (its usually more accurate)
                const redditComment = redditCommentLookup[comment.id]
                if (redditComment !== undefined) {
                  comment.score = redditComment.score
                }
              })

              this.setState({ pushshiftComments })
              return redditComments
            })
        )
      })
      .then(redditComments => {
        console.log('Number of comments from Reddit:', redditComments.length)
        const removed = []
        const deleted = []

        // Check what as removed / deleted according to reddit
        redditComments.forEach(comment => {
          if (isRemoved(comment.body)) {
            removed.push(comment.id)
          } else if (isDeleted(comment.body)) {
            deleted.push(comment.id)
          }
        })

        this.setState({
          removed,
          deleted,
          loadingComments: false,
        })
      })
  }

  render() {
    let root = this.state.post.id

    if (this.props.match.params.commentID !== undefined) {
      root = this.props.match.params.commentID
    }

    return (
      <div>
        <Post {...this.state.post} />
        {
          !this.state.loadingComments &&
          <CommentSection
            root={root}
            comments={this.state.pushshiftComments}
            removed={this.state.removed}
            deleted={this.state.deleted}
          />
        }
      </div>
    )
  }
}
