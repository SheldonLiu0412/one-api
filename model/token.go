package model

import (
	"errors"
	_ "gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"one-api/common"
	"strings"
)

type Token struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id"`
	Key            string `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status         int    `json:"status" gorm:"default:1"`
	Name           string `json:"name" gorm:"index" `
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	AccessedTime   int64  `json:"accessed_time" gorm:"bigint"`
	ExpiredTime    int64  `json:"expired_time" gorm:"bigint;default:-1"` // -1 means never expired
	RemainQuota    int    `json:"remain_quota" gorm:"default:0"`
	UnlimitedQuota bool   `json:"unlimited_quota" gorm:"default:false"`
}

func GetAllUserTokens(userId int, startIdx int, num int) ([]*Token, error) {
	var tokens []*Token
	var err error
	err = DB.Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	return tokens, err
}

func SearchUserTokens(userId int, keyword string) (tokens []*Token, err error) {
	err = DB.Where("user_id = ?", userId).Where("id = ? or name LIKE ?", keyword, keyword+"%").Find(&tokens).Error
	return tokens, err
}

func ValidateUserToken(key string) (token *Token, err error) {
	if key == "" {
		return nil, errors.New("未提供 token")
	}
	key = strings.Replace(key, "Bearer ", "", 1)
	token = &Token{}
	err = DB.Where("`key` = ?", key).First(token).Error
	if err == nil {
		if token.Status != common.TokenStatusEnabled {
			return nil, errors.New("该 token 状态不可用")
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			token.Status = common.TokenStatusExpired
			err := token.SelectUpdate()
			if err != nil {
				common.SysError("更新 token 状态失败：" + err.Error())
			}
			return nil, errors.New("该 token 已过期")
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			token.Status = common.TokenStatusExhausted
			err := token.SelectUpdate()
			if err != nil {
				common.SysError("更新 token 状态失败：" + err.Error())
			}
			return nil, errors.New("该 token 额度已用尽")
		}
		go func() {
			token.AccessedTime = common.GetTimestamp()
			err := token.SelectUpdate()
			if err != nil {
				common.SysError("更新 token 失败：" + err.Error())
			}
		}()
		return token, nil
	}
	return nil, errors.New("无效的 token")
}

func GetTokenByIds(id int, userId int) (*Token, error) {
	if id == 0 || userId == 0 {
		return nil, errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	var err error = nil
	err = DB.First(&token, "id = ? and user_id = ?", id, userId).Error
	return &token, err
}

func (token *Token) Insert() error {
	var err error
	err = DB.Create(token).Error
	return err
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (token *Token) Update() error {
	var err error
	err = DB.Model(token).Select("name", "status", "expired_time", "remain_quota", "unlimited_quota").Updates(token).Error
	return err
}

func (token *Token) SelectUpdate() error {
	// This can update zero values
	return DB.Model(token).Select("accessed_time", "status").Updates(token).Error
}

func (token *Token) Delete() error {
	var err error
	err = DB.Delete(token).Error
	return err
}

func DeleteTokenById(id int, userId int) (err error) {
	// Why we need userId here? In case user want to delete other's token.
	if id == 0 || userId == 0 {
		return errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	err = DB.Where(token).First(&token).Error
	if err != nil {
		return err
	}
	return token.Delete()
}

func DecreaseTokenRemainQuotaById(id int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Update("remain_quota", gorm.Expr("remain_quota - ?", 1)).Error
	return err
}

func TopUpToken(id int, times int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Update("remain_quota", gorm.Expr("remain_quota + ?", times)).Error
	return err
}
