<template>
  <div class="aplayer-lrc2">
    <div
      class="aplayer-lrc-contents2"
      :style="transformStyle"
    >
      <p
        v-for="(line, index) of lrcLines"
        :key="index"
        :class="{ 'aplayer-lrc-current2': index === currentLineIndex }"
      >
        {{ line[1] }}
      </p>
    </div>
  </div>
</template>

<script>
  import {parseLrc} from '../utils'

  export default {
    props: {
      currentMusic: {
        type: Object,
        required: true
      },
      playStat: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        displayLrc: '',
        currentLineIndex: 0,
      }
    },
    computed: {
      lrcLines () {
        return parseLrc(this.displayLrc)
      },
      currentLine () {
        if (this.currentLineIndex > this.lrcLines.length - 1) {
          return null
        }
        return this.lrcLines[this.currentLineIndex]
      },
      transformStyle () {
        // transform: translateY(0); -webkit-transform: translateY(0);
        return {
          transform: `translateY(${-this.currentLineIndex * 16}px)`,
          webkitTransform: `translateY(${-this.currentLineIndex * 16}px)`,
        }
      },
    },
    methods: {
      applyLrc (lrc) {
        if (/^http?:\/\//.test(lrc) || /^https?:\/\//.test(lrc)) {
          this.fetchLrc(lrc)
        } else {
          this.displayLrc = lrc
        }
      },
      fetchLrc (src) {
        fetch(src)
          .then(response => response.text())
          .then((lrc) => {
            this.displayLrc = lrc
          })
      },
      hideLrc () {
        this.displayLrc = ''
      },
    },
    watch: {
      currentMusic: {
        immediate: true,
        handler (music) {
          this.currentLineIndex = 0
          if (music.lrc) {
            this.applyLrc(music.lrc)
          } else {
            this.hideLrc()
          }
        }
      },
      'playStat.playedTime' (playedTime) {
        for (let i = 0; i < this.lrcLines.length; i++) {
          const line = this.lrcLines[i]
          const nextLine = this.lrcLines[i + 1]
          if (playedTime >= line[0] && (!nextLine || playedTime < nextLine[0])) {
            this.currentLineIndex = i
          }
        }
      },
    }
  }
</script>
<style lang="scss">
  @import "../scss/variables";

  .aplayer-lrc2 {
    position: relative;
    //height: 500px;
    text-align: center;
    overflow: hidden;
    margin-bottom: 7px;

    p {
      //font-size: 20px;
      color: #ffffff;
      line-height: 1.6;
      padding: 0;
      margin: 0;
      transition: all 0.5s ease-out;
      //opacity: 0.4;
      overflow: hidden;

      //&.aplayer-lrc-current2 {
      //  opacity: 1;
      //  color: #42b983 !important;
      //  overflow: visible;
      //  height: initial;
      //  font-size: 30px !important;
      //}

    }
    .aplayer-lrc-current2 {
      opacity: 1;
      color: #FAFA17 !important;
      overflow: visible;
      height: initial;
      font-size: 25px !important;;
    }
    .aplayer-lrc-contents2 {
      width: 100%;
      transition: all 0.5s ease-out;
      user-select: text;
      cursor: default;
    }
  }
</style>